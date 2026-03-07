/**
 * @file src/main/clients/zed.adapter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for Zed editor. Zed uses a fundamentally different
 * schema: MCP servers live under `context_servers` in the user's `settings.json`
 * at `%APPDATA%\Zed\settings.json`. Each entry has a different shape (`command`
 * is nested under `settings`) so the adapter handles Zed's specific structure
 * while exposing a standard `McpServerMap` to the rest of the app.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type {
  ClientDetectionResult,
  McpServerMap,
  McpServerConfig,
  ValidationResult,
} from '@shared/types'
import type { ClientAdapter } from './types'

// ─── Config Shape ─────────────────────────────────────────────────────────────

/**
 * Zed's context server entry shape. The command/args live under `settings`
 * rather than at the top level like other clients.
 */
interface ZedContextServerEntry {
  settings?: {
    command?: string
    args?: string[]
    env?: Record<string, string>
  }
  [key: string]: unknown
}

interface ZedConfig {
  context_servers?: Record<string, ZedContextServerEntry>
  [key: string]: unknown
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const configPath = (): string => join(process.env['APPDATA'] ?? '', 'Zed', 'settings.json')

// ─── Adapter ──────────────────────────────────────────────────────────────────

/** Zed editor client adapter for Windows. */
export const zedAdapter: ClientAdapter = {
  id: 'zed',
  displayName: 'Zed',
  schemaKey: 'context_servers',

  detect(): Promise<ClientDetectionResult> {
    const path = configPath()
    const installed = existsSync(path)
    let serverCount = 0

    if (installed) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as ZedConfig
        serverCount = Object.keys(raw.context_servers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(`[zed] detect: installed=${installed}, servers=${serverCount}`)

    return Promise.resolve({
      installed,
      configPaths: installed ? [path] : [],
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})

    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ZedConfig
    const contextServers = raw.context_servers ?? {}

    // Normalize Zed's nested format into the standard McpServerMap shape.
    // Extract settings first so TypeScript can narrow the type correctly —
    // &&-style conditional spreads don't narrow through optional chaining
    // when exactOptionalPropertyTypes is enabled.
    const normalized: Record<string, McpServerConfig> = {}
    for (const [name, entry] of Object.entries(contextServers)) {
      const s = entry.settings
      normalized[name] = {
        command: s?.command ?? '',
        ...(s !== undefined && s.args !== undefined ? { args: s.args } : {}),
        ...(s !== undefined && s.env !== undefined ? { env: s.env } : {}),
      }
    }

    return Promise.resolve(normalized)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: ZedConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as ZedConfig
    }

    // Convert our flat McpServerMap back into Zed's nested structure
    const contextServers: Record<string, ZedContextServerEntry> = {}
    for (const [name, server] of Object.entries(servers)) {
      contextServers[name] = {
        settings: {
          command: server.command,
          ...(server.args?.length ? { args: [...server.args] } : {}),
          ...(server.env && Object.keys(server.env).length ? { env: { ...server.env } } : {}),
        },
      }
    }

    const merged: ZedConfig = { ...existing, context_servers: contextServers }
    const tmpPath = `${configPath}.aidrelay.tmp`
    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[zed] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ZedConfig
      if (raw.context_servers !== undefined && typeof raw.context_servers !== 'object') {
        return Promise.resolve({ valid: false, errors: ['context_servers must be an object'] })
      }
      return Promise.resolve({ valid: true, errors: [] })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.resolve({ valid: false, errors: [`JSON parse error: ${message}`] })
    }
  },
}
