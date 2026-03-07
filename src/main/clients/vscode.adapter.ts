/**
 * @file src/main/clients/vscode.adapter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Client adapter for Visual Studio Code. Uses the `servers` schema
 * key (not `mcpServers`) as VS Code has its own MCP config format. Config lives
 * at `%APPDATA%\Code\User\mcp.json` on Windows.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'

// ─── Config Shape ─────────────────────────────────────────────────────────────

/**
 * Minimal shape of the VS Code MCP config JSON.
 * Note: VS Code uses `servers` at the top level, not `mcpServers`.
 */
interface VsCodeConfig {
  servers?: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns the absolute path to the VS Code MCP config on Windows.
 */
const configPath = (): string => join(process.env['APPDATA'] ?? '', 'Code', 'User', 'mcp.json')

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * VS Code client adapter for Windows.
 * Uses the `servers` key rather than `mcpServers`, which is a VS Code-specific
 * deviation from the format used by Claude Desktop and Cursor.
 */
export const vscodeAdapter: ClientAdapter = {
  id: 'vscode',
  displayName: 'VS Code',
  schemaKey: 'servers',

  detect(): Promise<ClientDetectionResult> {
    const path = configPath()
    const installed = existsSync(path)
    let serverCount = 0

    if (installed) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as VsCodeConfig
        serverCount = Object.keys(raw.servers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(`[vscode] detect: installed=${installed}, servers=${serverCount}`)

    return Promise.resolve({
      installed,
      configPaths: installed ? [path] : [],
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})

    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as VsCodeConfig
    return Promise.resolve((raw.servers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: VsCodeConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as VsCodeConfig
    }

    // VS Code uses `servers`, not `mcpServers`
    const merged: VsCodeConfig = { ...existing, servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[vscode] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as VsCodeConfig

      if (raw.servers !== undefined && typeof raw.servers !== 'object') {
        return Promise.resolve({ valid: false, errors: ['servers must be an object'] })
      }

      return Promise.resolve({ valid: true, errors: [] })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.resolve({ valid: false, errors: [`JSON parse error: ${message}`] })
    }
  },
}
