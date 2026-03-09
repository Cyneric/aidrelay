/**
 * @file src/main/clients/codex-cli.adapter.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Client adapter for OpenAI Codex CLI. Config lives at
 * `%USERPROFILE%\.codex\config.json` on Windows. The MCP server schema key
 * is `mcpServers`, following the same format as Claude Desktop and Cursor.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'
import { hasWindowsCommandOnPath } from './windows-detection.util'

// ─── Config Shape ─────────────────────────────────────────────────────────────

interface CodexConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const configPath = (): string => join(process.env['USERPROFILE'] ?? '', '.codex', 'config.json')

/**
 * Checks common Codex CLI install locations and PATH command aliases.
 */
const isCodexCliInstalled = (): boolean => {
  if (process.platform !== 'win32') return false

  const appData = process.env['APPDATA'] ?? ''
  const localAppData = process.env['LOCALAPPDATA'] ?? ''

  const candidates = [
    join(appData, 'npm', 'codex.cmd'),
    join(appData, 'npm', 'codex.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'codex.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'codex.cmd'),
  ]

  if (candidates.some((path) => existsSync(path))) {
    return true
  }

  return hasWindowsCommandOnPath(['codex'])
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/** OpenAI Codex CLI client adapter for Windows. */
export const codexCliAdapter: ClientAdapter = {
  id: 'codex-cli',
  displayName: 'Codex CLI',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const path = configPath()
    const hasConfig = existsSync(path)
    const installed = hasConfig || isCodexCliInstalled()
    let serverCount = 0

    if (hasConfig) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as CodexConfig
        serverCount = Object.keys(raw.mcpServers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(`[codex-cli] detect: installed=${installed}, servers=${serverCount}`)

    return Promise.resolve({
      installed,
      configPaths: hasConfig ? [path] : [],
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as CodexConfig
    return Promise.resolve((raw.mcpServers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: CodexConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as CodexConfig
    }

    const merged: CodexConfig = { ...existing, mcpServers: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`
    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[codex-cli] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as CodexConfig
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
