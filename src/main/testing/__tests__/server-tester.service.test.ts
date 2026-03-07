/**
 * @file src/main/testing/__tests__/server-tester.service.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for ServerTesterService. The `child_process` module
 * and keytar service are mocked so tests run without spawning real processes
 * or accessing the credential store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { McpServer } from '@shared/types'

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@main/secrets/keytar.service', () => ({
  getSecret: vi.fn().mockResolvedValue(null),
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('child_process', () => ({ spawn: vi.fn() }))

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { spawn } from 'child_process'
import { ServerTesterService } from '../server-tester.service'

/** Creates a minimal McpServer fixture for testing. */
const makeServer = (overrides: Partial<McpServer> = {}): McpServer => ({
  id: 'test-id',
  name: 'test-server',
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@test/mcp'],
  env: {},
  secretEnvKeys: [],
  enabled: true,
  clientOverrides: {
    'claude-desktop': { enabled: true },
    'claude-code': { enabled: true },
    cursor: { enabled: true },
    vscode: { enabled: true },
    windsurf: { enabled: true },
    zed: { enabled: true },
    jetbrains: { enabled: true },
    'codex-cli': { enabled: true },
  },
  tags: [],
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

type SpawnInstance = {
  stdout: { on: ReturnType<typeof vi.fn> }
  stdin: { write: ReturnType<typeof vi.fn> }
  on: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
}

/** Creates a fake child process that can emit events. */
const makeSpawnMock = (): SpawnInstance => ({
  stdout: { on: vi.fn() },
  stdin: { write: vi.fn() },
  on: vi.fn(),
  kill: vi.fn(),
})

/** Emits a valid JSON-RPC initialize response from the fake child process. */
const emitStdoutLine = (child: SpawnInstance, line: string): void => {
  const dataHandler = child.stdout.on.mock.calls.find((call) => call[0] === 'data')?.[1] as
    | ((chunk: Buffer) => void)
    | undefined
  dataHandler?.(Buffer.from(line + '\n'))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ServerTesterService', () => {
  let tester: ServerTesterService

  beforeEach(() => {
    vi.clearAllMocks()
    tester = new ServerTesterService()
  })

  describe('testServer()', () => {
    it('returns unsupported message for non-stdio servers', async () => {
      const result = await tester.testServer(makeServer({ type: 'sse' }))

      expect(result.success).toBe(false)
      expect(result.message).toMatch(/not yet supported/)
    })

    it('returns success when the server responds with a valid initialize result', async () => {
      const child = makeSpawnMock()
      vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>)

      const promise = tester.testServer(makeServer())

      // Simulate a valid MCP initialize response after a short delay.
      setTimeout(() => {
        emitStdoutLine(
          child,
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              serverInfo: { name: 'Test MCP Server', version: '1.0.0' },
              capabilities: {},
            },
          }),
        )
      }, 10)

      const result = await promise
      expect(result.success).toBe(true)
      expect(result.message).toContain('Test MCP Server')
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('returns failure when the server sends a JSON-RPC error', async () => {
      const child = makeSpawnMock()
      vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>)

      const promise = tester.testServer(makeServer())

      setTimeout(() => {
        emitStdoutLine(
          child,
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32600, message: 'Invalid Request' },
          }),
        )
      }, 10)

      const result = await promise
      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid Request')
    })

    it('returns failure when spawn throws', async () => {
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('ENOENT: command not found')
      })

      const result = await tester.testServer(makeServer())
      expect(result.success).toBe(false)
      expect(result.message).toMatch(/spawn/)
    })

    it('returns failure when the process emits an error event', async () => {
      const child = makeSpawnMock()
      vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>)

      const promise = tester.testServer(makeServer())

      setTimeout(() => {
        const errHandler = child.on.mock.calls.find((call) => call[0] === 'error')?.[1] as
          | ((err: Error) => void)
          | undefined
        errHandler?.(new Error('ENOENT'))
      }, 10)

      const result = await promise
      expect(result.success).toBe(false)
      expect(result.message).toContain('ENOENT')
    })

    it('returns failure when the process exits without responding', async () => {
      const child = makeSpawnMock()
      vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>)

      const promise = tester.testServer(makeServer())

      setTimeout(() => {
        const closeHandler = child.on.mock.calls.find((call) => call[0] === 'close')?.[1] as
          | ((code: number) => void)
          | undefined
        closeHandler?.(1)
      }, 10)

      const result = await promise
      expect(result.success).toBe(false)
      expect(result.message).toMatch(/exited/)
    })
  })
})
