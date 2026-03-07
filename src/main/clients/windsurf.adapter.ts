/**
 * @file src/main/clients/windsurf.adapter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Client adapter for Windsurf IDE. Config lives at
 * `%USERPROFILE%\.codeium\windsurf\mcp_config.json` on Windows and uses
 * the `mcpServers` schema key, matching the Claude Desktop format.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'

// ─── Config Shape ─────────────────────────────────────────────────────────────

interface WindsurfConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const configPath = (): string =>
  join(process.env['USERPROFILE'] ?? '', '.codeium', 'windsurf', 'mcp_config.json')

// ─── Adapter ──────────────────────────────────────────────────────────────────

/** Windsurf IDE client adapter for Windows. */
export const windsurfAdapter: ClientAdapter = {
  id: 'windsurf',
  displayName: 'Windsurf',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const path = configPath()
    const installed = existsSync(path)
    let serverCount = 0

    if (installed) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as WindsurfConfig
        serverCount = Object.keys(raw.mcpServers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(`[windsurf] detect: installed=${installed}, servers=${serverCount}`)

    return Promise.resolve({
      installed,
      configPaths: installed ? [path] : [],
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as WindsurfConfig
    return Promise.resolve((raw.mcpServers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: WindsurfConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as WindsurfConfig
    }

    const merged: WindsurfConfig = { ...existing, mcpServers: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`
    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[windsurf] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as WindsurfConfig
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
