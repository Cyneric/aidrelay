/**
 * @file src/main/clients/cursor.adapter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for Cursor IDE. Reads and writes the global MCP
 * config at `%USERPROFILE%\.cursor\mcp.json`. Uses the `mcpServers` schema key,
 * matching the Claude Desktop format.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'

// ─── Config Shape ─────────────────────────────────────────────────────────────

/**
 * Minimal shape of the Cursor global MCP config JSON.
 */
interface CursorConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns the absolute path to the Cursor global MCP config on Windows.
 */
const configPath = (): string => join(process.env['USERPROFILE'] ?? '', '.cursor', 'mcp.json')

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Cursor IDE client adapter for Windows.
 * Targets the global `~/.cursor/mcp.json` config file.
 */
export const cursorAdapter: ClientAdapter = {
  id: 'cursor',
  displayName: 'Cursor',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const path = configPath()
    const installed = existsSync(path)
    let serverCount = 0

    if (installed) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as CursorConfig
        serverCount = Object.keys(raw.mcpServers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(`[cursor] detect: installed=${installed}, servers=${serverCount}`)

    return Promise.resolve({
      installed,
      configPaths: installed ? [path] : [],
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})

    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as CursorConfig
    return Promise.resolve((raw.mcpServers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: CursorConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as CursorConfig
    }

    const merged: CursorConfig = { ...existing, mcpServers: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[cursor] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as CursorConfig

      if (raw.mcpServers !== undefined && typeof raw.mcpServers !== 'object') {
        return Promise.resolve({ valid: false, errors: ['mcpServers must be an object'] })
      }

      return Promise.resolve({ valid: true, errors: [] })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.resolve({ valid: false, errors: [`JSON parse error: ${message}`] })
    }
  },
}
