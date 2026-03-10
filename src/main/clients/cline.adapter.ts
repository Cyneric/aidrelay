/**
 * @file src/main/clients/cline.adapter.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for Cline. Reads and writes MCP settings files
 * from VS Code and Cursor extension globalStorage directories.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import log from 'electron-log'
import type { ClientAdapter } from './types'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'

interface ClineConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

const globalStorageRoots = (): readonly string[] => {
  const appData = process.env['APPDATA'] ?? ''
  if (!appData) return []
  return [
    join(appData, 'Code', 'User', 'globalStorage'),
    join(appData, 'Cursor', 'User', 'globalStorage'),
  ]
}

const dedupe = (values: readonly string[]): string[] =>
  values.filter((value, index, all) => all.indexOf(value) === index)

const clineConfigPaths = (): string[] => {
  const matches: string[] = []

  for (const root of globalStorageRoots()) {
    if (!existsSync(root)) continue

    let entries: Array<{ isDirectory(): boolean; name: string }>
    try {
      entries = readdirSync(root, { withFileTypes: true }) as Array<{
        isDirectory(): boolean
        name: string
      }>
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const candidate = join(root, entry.name, 'settings', 'cline_mcp_settings.json')
      if (existsSync(candidate)) {
        matches.push(candidate)
      }
    }
  }

  return dedupe(matches)
}

const hasClineStorage = (): boolean => {
  for (const root of globalStorageRoots()) {
    if (!existsSync(root)) continue

    let entries: Array<{ isDirectory(): boolean; name: string }>
    try {
      entries = readdirSync(root, { withFileTypes: true }) as Array<{
        isDirectory(): boolean
        name: string
      }>
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const lower = entry.name.toLowerCase()
      if (lower.includes('cline') || lower.includes('claude-dev')) {
        return true
      }
    }
  }

  return false
}

const countServers = (path: string): number => {
  if (!existsSync(path)) return 0

  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as ClineConfig
    return Object.keys(raw.mcpServers ?? {}).length
  } catch {
    return 0
  }
}

export const clineAdapter: ClientAdapter = {
  id: 'cline',
  displayName: 'Cline',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const paths = clineConfigPaths()
    const installed = paths.length > 0 || hasClineStorage()
    const serverCount = paths.reduce((sum, path) => sum + countServers(path), 0)

    log.debug(
      `[cline] detect: installed=${installed}, paths=${paths.length}, servers=${serverCount}`,
    )

    return Promise.resolve({
      installed,
      configPaths: paths,
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})

    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ClineConfig
    return Promise.resolve((raw.mcpServers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: ClineConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as ClineConfig
    }

    const merged: ClineConfig = { ...existing, mcpServers: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[cline] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as ClineConfig
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
