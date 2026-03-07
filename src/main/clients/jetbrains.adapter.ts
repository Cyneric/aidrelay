/**
 * @file src/main/clients/jetbrains.adapter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for JetBrains IDEs (IntelliJ IDEA, WebStorm, etc.).
 * JetBrains does not yet have a standardized MCP config file — instead, MCP
 * servers are configured through the IDE's settings UI. Detection checks for
 * common JetBrains config directories under `%APPDATA%\JetBrains\` to determine
 * if any JetBrains IDE is installed. Read/write are no-ops since there is no
 * file-based config path; the clipboard-import approach is used instead.
 */

import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns `true` if any JetBrains IDE config directory exists under
 * `%APPDATA%\JetBrains\`. Checks for well-known product directory prefixes.
 */
const isJetBrainsInstalled = (): boolean => {
  const appData = process.env['APPDATA'] ?? ''
  const jetbrainsDir = join(appData, 'JetBrains')

  if (!existsSync(jetbrainsDir)) return false

  const KNOWN_PREFIXES = [
    'IntelliJIdea',
    'WebStorm',
    'PyCharm',
    'PhpStorm',
    'CLion',
    'GoLand',
    'Rider',
    'RubyMine',
    'DataGrip',
  ]

  try {
    const entries = readdirSync(jetbrainsDir)
    return entries.some((entry) => KNOWN_PREFIXES.some((prefix) => entry.startsWith(prefix)))
  } catch {
    return false
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * JetBrains client adapter for Windows.
 * Detection identifies whether any JetBrains IDE is present. Read and write
 * are no-ops — JetBrains MCP configuration is done through the IDE settings UI
 * or via clipboard-paste of the server JSON.
 */
export const jetbrainsAdapter: ClientAdapter = {
  id: 'jetbrains',
  displayName: 'JetBrains',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const installed = isJetBrainsInstalled()
    log.debug(`[jetbrains] detect: installed=${installed}`)

    return Promise.resolve({
      installed,
      // No file-based config path — the adapter is clipboard/manual only
      configPaths: [],
      serverCount: 0,
    })
  },

  read(_configPath: string): Promise<McpServerMap> {
    // JetBrains uses IDE settings UI, not a file-based config
    return Promise.resolve({})
  },

  write(_configPath: string, _servers: McpServerMap): Promise<void> {
    // No file-based write for JetBrains — user configures via the IDE
    log.warn('[jetbrains] write() called but JetBrains uses clipboard/manual config only')
    return Promise.resolve()
  },

  validate(_configPath: string): Promise<ValidationResult> {
    return Promise.resolve({ valid: true, errors: [] })
  },
}
