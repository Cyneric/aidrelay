/**
 * @file src/main/clients/claude-code.adapter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for Claude Code CLI. Checks two config locations:
 * `%USERPROFILE%\.claude.json` (legacy) and `%USERPROFILE%\.claude\settings.json`
 * (current). Both use the `mcpServers` schema key. The adapter reports all found
 * paths and reads/writes from the first available one.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'

// ─── Config Shapes ────────────────────────────────────────────────────────────

interface ClaudeCodeConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the legacy flat config path. */
const legacyConfigPath = (): string => join(process.env['USERPROFILE'] ?? '', '.claude.json')

/** Returns the current settings.json path used by newer Claude Code versions. */
const settingsConfigPath = (): string =>
  join(process.env['USERPROFILE'] ?? '', '.claude', 'settings.json')

const countServers = (configPath: string): number => {
  if (!existsSync(configPath)) return 0
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ClaudeCodeConfig
    return Object.keys(raw.mcpServers ?? {}).length
  } catch {
    return 0
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/** Claude Code CLI client adapter for Windows. */
export const claudeCodeAdapter: ClientAdapter = {
  id: 'claude-code',
  displayName: 'Claude Code',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const configPaths: string[] = []
    let serverCount = 0

    const legacy = legacyConfigPath()
    if (existsSync(legacy)) {
      configPaths.push(legacy)
      serverCount += countServers(legacy)
    }

    const settings = settingsConfigPath()
    if (existsSync(settings)) {
      configPaths.push(settings)
      serverCount += countServers(settings)
    }

    log.debug(`[claude-code] detect: found ${configPaths.length} config path(s)`)

    return Promise.resolve({
      installed: configPaths.length > 0,
      configPaths,
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ClaudeCodeConfig
    return Promise.resolve((raw.mcpServers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: ClaudeCodeConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as ClaudeCodeConfig
    }

    const merged: ClaudeCodeConfig = { ...existing, mcpServers: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`
    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[claude-code] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ClaudeCodeConfig
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
