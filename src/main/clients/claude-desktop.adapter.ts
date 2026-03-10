/**
 * @file src/main/clients/claude-desktop.adapter.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for Claude Desktop. Handles both the standard
 * NSIS install path and the MSIX (Microsoft Store) variant. On detection the
 * adapter scans the `Packages` directory for any folder that starts with
 * `Claude_` to locate the MSIX config without a glob library.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'

// ─── Config Shape ─────────────────────────────────────────────────────────────

/**
 * Minimal shape of the Claude Desktop config JSON that we care about.
 * We preserve every other key untouched when writing.
 */
interface ClaudeConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the primary (NSIS installer) Claude Desktop config path for Windows.
 *
 * @returns Absolute path to the config file, regardless of whether it exists.
 */
const primaryConfigPath = (): string =>
  join(process.env['APPDATA'] ?? '', 'Claude', 'claude_desktop_config.json')

/**
 * Attempts to locate the MSIX (Microsoft Store) variant of the Claude Desktop
 * config by scanning `%LOCALAPPDATA%\Packages` for a directory that starts
 * with `Claude_`. Returns `null` when no MSIX install is found.
 *
 * @returns Absolute path to the MSIX config file, or `null`.
 */
const msixConfigPath = (): string | null => {
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const packagesDir = join(localAppData, 'Packages')

  if (!existsSync(packagesDir)) return null

  let claudePkg: string | undefined
  try {
    claudePkg = readdirSync(packagesDir).find((d) => d.startsWith('Claude_'))
  } catch {
    return null
  }

  if (!claudePkg) return null

  return join(
    packagesDir,
    claudePkg,
    'LocalCache',
    'Roaming',
    'Claude',
    'claude_desktop_config.json',
  )
}

/**
 * Counts the number of MCP servers declared in a config file.
 * Returns 0 if the file is missing or malformed.
 *
 * @param configPath - Absolute path to the config file.
 * @returns Number of server entries found.
 */
const countServers = (configPath: string): number => {
  if (!existsSync(configPath)) return 0
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ClaudeConfig
    return Object.keys(raw.mcpServers ?? {}).length
  } catch {
    return 0
  }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Claude Desktop client adapter for Windows.
 * Supports both the NSIS (standard) and MSIX (Microsoft Store) install variants.
 */
export const claudeDesktopAdapter: ClientAdapter = {
  id: 'claude-desktop',
  displayName: 'Claude Desktop',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const configPaths: string[] = []
    let serverCount = 0

    const primary = primaryConfigPath()
    if (existsSync(primary)) {
      configPaths.push(primary)
      serverCount += countServers(primary)
    }

    const msix = msixConfigPath()
    if (msix && existsSync(msix)) {
      configPaths.push(msix)
      serverCount += countServers(msix)
    }

    log.debug(`[claude-desktop] detect: found ${configPaths.length} config path(s)`)

    return Promise.resolve({
      installed: configPaths.length > 0,
      configPaths,
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ClaudeConfig
      return Promise.resolve((raw.mcpServers ?? {}) as McpServerMap)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.warn(`[claude-desktop] failed to parse config ${configPath}: ${message}`)
      return Promise.resolve({})
    }
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    // Ensure the parent directory exists before writing
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: ClaudeConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as ClaudeConfig
    }

    const merged: ClaudeConfig = { ...existing, mcpServers: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[claude-desktop] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ClaudeConfig

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
