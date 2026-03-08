/**
 * @file src/main/clients/opencode.adapter.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for OpenCode. Supports both global config
 * (`~/.config/opencode/opencode.json`) and project-level `opencode.json`
 * files discovered from recent workspaces.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import log from 'electron-log'
import type { ClientAdapter } from './types'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import { detectRecentWorkspaces } from '@main/rules/workspace-detector'

interface OpenCodeConfig {
  mcp?: Record<string, unknown>
  [key: string]: unknown
}

const userHome = (): string => process.env['USERPROFILE'] ?? process.env['HOME'] ?? ''

const globalConfigPath = (): string => join(userHome(), '.config', 'opencode', 'opencode.json')

const isOnPath = (baseNames: readonly string[]): boolean => {
  const pathEnv = process.env['PATH'] ?? ''
  const pathDirs = pathEnv.split(';').filter(Boolean)
  if (pathDirs.length === 0) return false

  const pathExt = (process.env['PATHEXT'] ?? '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .map((ext) => ext.toLowerCase())

  for (const dir of pathDirs) {
    for (const base of baseNames) {
      const normalizedBase = base.toLowerCase()
      for (const ext of pathExt) {
        const candidate = join(dir, `${normalizedBase}${ext}`)
        if (existsSync(candidate)) return true
      }
    }
  }

  return false
}

const isOpenCodeInstalled = (): boolean => {
  if (process.platform !== 'win32') return false
  if (isOnPath(['opencode'])) return true

  const appData = process.env['APPDATA'] ?? ''
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const candidates = [
    join(appData, 'npm', 'opencode.cmd'),
    join(appData, 'npm', 'opencode.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'opencode.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'opencode.cmd'),
  ]

  return candidates.some((path) => existsSync(path))
}

const projectConfigPaths = (): string[] =>
  detectRecentWorkspaces()
    .map((workspace) => join(workspace, 'opencode.json'))
    .filter((path, index, arr) => arr.indexOf(path) === index && existsSync(path))

const countServers = (path: string): number => {
  if (!existsSync(path)) return 0
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as OpenCodeConfig
    return Object.keys(raw.mcp ?? {}).length
  } catch {
    return 0
  }
}

export const opencodeAdapter: ClientAdapter = {
  id: 'opencode',
  displayName: 'OpenCode',
  schemaKey: 'mcp',

  detect(): Promise<ClientDetectionResult> {
    const paths: string[] = []
    const globalPath = globalConfigPath()
    if (existsSync(globalPath)) {
      paths.push(globalPath)
    }
    paths.push(...projectConfigPaths())

    const serverCount = paths.reduce((sum, path) => sum + countServers(path), 0)
    const installed = paths.length > 0 || isOpenCodeInstalled()

    log.debug(
      `[opencode] detect: installed=${installed}, paths=${paths.length}, servers=${serverCount}`,
    )

    return Promise.resolve({
      installed,
      configPaths: paths,
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as OpenCodeConfig
    return Promise.resolve((raw.mcp ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: OpenCodeConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as OpenCodeConfig
    }

    const merged: OpenCodeConfig = { ...existing, mcp: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[opencode] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as OpenCodeConfig
      if (raw.mcp !== undefined && typeof raw.mcp !== 'object') {
        return Promise.resolve({ valid: false, errors: ['mcp must be an object'] })
      }
      return Promise.resolve({ valid: true, errors: [] })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.resolve({ valid: false, errors: [`JSON parse error: ${message}`] })
    }
  },
}
