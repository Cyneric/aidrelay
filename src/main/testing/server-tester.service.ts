/**
 * @file src/main/testing/server-tester.service.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description MCP server connection tester. For stdio servers it spawns the
 * server process, sends a JSON-RPC `initialize` request, and verifies that a
 * valid response arrives within a configurable timeout. For sse/http servers it
 * issues a GET request to the configured URL and treats any HTTP response as
 * success.
 */

import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import log from 'electron-log'
import type { McpServer } from '@shared/types'
import type { TestResult } from '@shared/channels'
import { getSecret } from '@main/secrets/keytar.service'
import { toSecretHeaderAccountKey } from '@main/secrets/secret-keys'
import { CommandLaunchError, spawnCommandWithWindowsFallback } from './command-launch.util'

/** How long to wait for an initialize response before declaring a timeout. */
const STDIO_TIMEOUT_MS = 30000
const HTTP_SSE_TIMEOUT_MS = 5000

/** MCP protocol version sent in the initialize request. */
const PROTOCOL_VERSION = '2024-11-05'

// ─── JSON-RPC Helpers ─────────────────────────────────────────────────────────

/** Shape of the JSON-RPC initialize request params. */
interface InitializeParams {
  protocolVersion: string
  capabilities: Record<string, unknown>
  clientInfo: { name: string; version: string }
}

/** Shape of a JSON-RPC 2.0 request message. */
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: InitializeParams
}

/** Minimal shape of the initialize result we care about for validation. */
interface InitializeResult {
  serverInfo?: { name?: string; version?: string }
  capabilities?: Record<string, unknown>
}

/** Shape of a JSON-RPC 2.0 response message. */
interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: InitializeResult
  error?: { code: number; message: string }
}

const INITIALIZE_REQUEST_ID = 1
const MAX_STDERR_CHARS = 4000
const MAX_DETAILS_CHARS = 2000
const NOISY_STDERR_PATTERNS = [
  /^npm warn Unknown env config "verify-deps-before-run"\.?/i,
  /^npm warn Unknown env config "_jsr-registry"\.?/i,
]

const sanitizeDiagnosticText = (input: string): string | undefined => {
  const cleaned = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !NOISY_STDERR_PATTERNS.some((pattern) => pattern.test(line)))

  if (cleaned.length === 0) return undefined
  const joined = cleaned.join('\n')
  return joined.length > MAX_DETAILS_CHARS
    ? `${joined.slice(0, MAX_DETAILS_CHARS).trimEnd()}…`
    : joined
}

const buildFailureResult = (message: string, rawStderr: string, hint?: string): TestResult => {
  const trimmedRaw = rawStderr.trim()
  if (trimmedRaw.length > 0) {
    log.debug(`[tester] stderr tail: ${trimmedRaw}`)
  }

  const details = sanitizeDiagnosticText(trimmedRaw)
  return {
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(hint ? { hint } : {}),
  }
}

const timeoutHintForServer = (server: McpServer): string => {
  const fullCommand = `${server.command} ${server.args.join(' ')}`.toLowerCase()
  if (fullCommand.includes('chrome-devtools-mcp')) {
    return 'The server started but did not reply to MCP initialize. Ensure Chrome is running with remote debugging on the configured --browser-url port.'
  }
  return 'The server process started but did not reply to MCP initialize. Verify the command starts an MCP stdio server and run it manually to inspect startup output.'
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Runs a connection test against a single MCP server by performing a
 * JSON-RPC `initialize` handshake. Returns a `TestResult` describing the
 * outcome — it never throws.
 */
export class ServerTesterService {
  /**
   * Builds the full environment object for the spawned server process by
   * merging non-secret env vars with secret values from the credential store.
   *
   * @param server - The server whose env and secretEnvKeys to resolve.
   * @returns A plain env object safe to pass to `spawn`.
   */
  private async buildEnv(server: McpServer): Promise<Record<string, string | undefined>> {
    const base: Record<string, string> = { ...server.env }
    for (const key of server.secretEnvKeys) {
      const value = await getSecret(server.name, key)
      if (value !== null) {
        base[key] = value
      }
    }
    return { ...process.env, ...base }
  }

  /**
   * Builds request headers for HTTP/SSE checks, including secret header values.
   */
  private async buildHeaders(server: McpServer): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...server.headers }
    for (const key of server.secretHeaderKeys) {
      const value = await getSecret(server.name, toSecretHeaderAccountKey(key))
      if (value !== null) {
        headers[key] = value
      }
    }
    return headers
  }

  /**
   * Tests a stdio-transport MCP server by spawning it and sending an
   * `initialize` JSON-RPC request over stdin/stdout.
   *
   * @param server - The `McpServer` record to test.
   * @returns A `TestResult` describing whether the handshake succeeded.
   */
  private async testStdioServer(
    server: McpServer,
    env: Record<string, string | undefined>,
  ): Promise<TestResult> {
    const startedAt = Date.now()

    let child: ChildProcessWithoutNullStreams
    try {
      const launch = await spawnCommandWithWindowsFallback(server.command, [...server.args], {
        env,
        stdio: 'pipe',
        windowsHide: true,
      })
      child = launch.child
    } catch (err) {
      if (err instanceof CommandLaunchError) {
        if (err.kind === 'executable_not_found') {
          return {
            success: false,
            message: `Executable not found: ${server.command}`,
          }
        }
        return {
          success: false,
          message: `Failed to spawn process "${server.command}": ${err.message}`,
        }
      }
      return {
        success: false,
        message: `Failed to spawn process "${server.command}": ${String(err)}`,
      }
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: INITIALIZE_REQUEST_ID,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'aidrelay', version: '0.1.0' },
      },
    }

    let stdoutBuffer = Buffer.alloc(0)
    let stderrBuffer = ''
    let settled = false

    return new Promise<TestResult>((resolve) => {
      const settle = (result: TestResult): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          child.kill()
        } catch {
          // process may have already exited
        }
        resolve(result)
      }

      const handleResponse = (response: JsonRpcResponse): void => {
        if (response.id === INITIALIZE_REQUEST_ID && response.error) {
          settle({
            success: false,
            message: `Server returned error: ${response.error.message}`,
          })
          return
        }
        if (response.id === INITIALIZE_REQUEST_ID && response.result) {
          const serverName = response.result.serverInfo?.name ?? server.name
          settle({
            success: true,
            message: `Connected — ${serverName}`,
            responseTimeMs: Date.now() - startedAt,
          })
        }
      }

      const processStdoutBuffer = (): void => {
        while (!settled && stdoutBuffer.length > 0) {
          const startsWithContentLength =
            stdoutBuffer.length >= 15 &&
            stdoutBuffer.subarray(0, 15).toString('utf8').toLowerCase() === 'content-length:'

          if (startsWithContentLength) {
            const headerEnd = stdoutBuffer.indexOf('\r\n\r\n')
            if (headerEnd === -1) return

            const header = stdoutBuffer.subarray(0, headerEnd).toString('utf8')
            const lengthMatch = /content-length\s*:\s*(\d+)/i.exec(header)
            if (!lengthMatch) {
              stdoutBuffer = stdoutBuffer.subarray(headerEnd + 4)
              continue
            }

            const contentLength = Number(lengthMatch[1])
            const bodyStart = headerEnd + 4
            const bodyEnd = bodyStart + contentLength
            if (stdoutBuffer.length < bodyEnd) return

            const body = stdoutBuffer.subarray(bodyStart, bodyEnd).toString('utf8')
            stdoutBuffer = stdoutBuffer.subarray(bodyEnd)
            try {
              handleResponse(JSON.parse(body) as JsonRpcResponse)
            } catch {
              // Ignore malformed payloads and keep reading.
            }
            continue
          }

          const newlineIndex = stdoutBuffer.indexOf('\n')
          if (newlineIndex === -1) return

          const line = stdoutBuffer.subarray(0, newlineIndex).toString('utf8').trim()
          stdoutBuffer = stdoutBuffer.subarray(newlineIndex + 1)
          if (!line) continue

          try {
            handleResponse(JSON.parse(line) as JsonRpcResponse)
          } catch {
            // Ignore non-JSON log lines.
          }
        }
      }

      const timer = setTimeout(() => {
        settle(
          buildFailureResult(
            `No initialize response after ${STDIO_TIMEOUT_MS / 1000}s.`,
            stderrBuffer,
            timeoutHintForServer(server),
          ),
        )
      }, STDIO_TIMEOUT_MS)

      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBuffer = Buffer.concat([stdoutBuffer, chunk])
        processStdoutBuffer()
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        const next = stderrBuffer + chunk.toString('utf8')
        stderrBuffer = next.length > MAX_STDERR_CHARS ? next.slice(-MAX_STDERR_CHARS) : next
      })

      child.on('error', (err: Error) => {
        settle(
          buildFailureResult('Process error while waiting for initialize response.', err.message),
        )
      })

      child.on('close', (code: number | null) => {
        if (!settled) {
          settle(
            buildFailureResult(
              `Process exited unexpectedly (code ${code ?? 'null'}).`,
              stderrBuffer,
            ),
          )
        }
      })

      // Send the initialize request after the process starts.
      try {
        child.stdin?.write(JSON.stringify(request) + '\n')
      } catch (err) {
        settle({ success: false, message: `Failed to write to stdin: ${String(err)}` })
      }
    })
  }

  /**
   * Tests an HTTP/SSE MCP server by issuing a GET request to its URL.
   * Any HTTP response (2xx, 4xx, 5xx) indicates the server is reachable.
   *
   * @param server - The `McpServer` record with type `sse` or `http` and a `url`.
   * @returns A `TestResult` describing whether the endpoint responded.
   */
  private async testHttpSseServer(server: McpServer): Promise<TestResult> {
    const headers = await this.buildHeaders(server)

    return new Promise<TestResult>((resolve) => {
      const url = server.url?.trim()
      if (!url) {
        resolve({ success: false, message: 'No URL configured for HTTP/SSE server' })
        return
      }

      const startedAt = Date.now()
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        resolve({ success: false, message: `Invalid URL: ${url}` })
        return
      }

      const isHttps = parsed.protocol === 'https:'
      const client = isHttps ? https : http

      const req = client.get(
        url,
        {
          timeout: HTTP_SSE_TIMEOUT_MS,
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        },
        (res) => {
          res.resume() // Consume body so the connection can close
          const responseTimeMs = Date.now() - startedAt
          // Any HTTP response means the server is reachable.
          resolve({
            success: true,
            message: `Connected — HTTP ${res.statusCode}`,
            responseTimeMs,
          })
        },
      )

      req.on('timeout', () => {
        req.destroy()
        resolve({
          success: false,
          message: `Timeout: no response after ${HTTP_SSE_TIMEOUT_MS / 1000}s`,
        })
      })

      req.on('error', (err: Error) => {
        const msg = err.message ?? String(err)
        resolve({
          success: false,
          message: msg.includes('ECONNREFUSED')
            ? 'Connection refused — is the server running?'
            : msg,
        })
      })
    })
  }

  /**
   * Tests a single MCP server and returns a descriptive result.
   * Never throws — all errors are captured in the returned `TestResult`.
   *
   * @param server - The server configuration to test.
   * @returns Promise resolving to a `TestResult`.
   */
  async testServer(server: McpServer): Promise<TestResult> {
    log.debug(`[tester] testing "${server.name}" (${server.type})`)

    if (server.type === 'sse' || server.type === 'http') {
      return this.testHttpSseServer(server)
    }

    if (server.type !== 'stdio') {
      return {
        success: false,
        message: 'Unknown server type — only stdio, sse, and http are supported.',
      }
    }

    try {
      const env = await this.buildEnv(server)
      return await this.testStdioServer(server, env)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`[tester] unexpected error for "${server.name}": ${message}`)
      return { success: false, message }
    }
  }
}

/** Shared singleton used by the servers IPC handler. */
export const serverTester = new ServerTesterService()
