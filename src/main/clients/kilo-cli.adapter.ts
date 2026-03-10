/**
 * @file src/main/clients/kilo-cli.adapter.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for Kilo CLI. Supports global config at
 * `%USERPROFILE%\.config\kilocode\kilocode.json` and project-level
 * `kilocode.json` files discovered from recent workspaces.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import log from 'electron-log'
import type { ClientAdapter } from './types'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import { hasWindowsCommandOnPath } from './windows-detection.util'
import { detectRecentWorkspaces } from '@main/rules/workspace-detector'

interface KiloConfig {
  mcp?: Record<string, unknown>
  [key: string]: unknown
}

const userHome = (): string => process.env['USERPROFILE'] ?? process.env['HOME'] ?? ''

const globalConfigPath = (): string => join(userHome(), '.config', 'kilocode', 'kilocode.json')

const projectConfigPaths = (): string[] =>
  detectRecentWorkspaces()
    .map((workspace) => join(workspace, 'kilocode.json'))
    .filter((path, index, all) => all.indexOf(path) === index && existsSync(path))

const isKiloCliInstalled = (): boolean => {
  if (process.platform !== 'win32') return false

  const appData = process.env['APPDATA'] ?? ''
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const candidates = [
    join(appData, 'npm', 'kilo.cmd'),
    join(appData, 'npm', 'kilo.exe'),
    join(appData, 'npm', 'kilocode.cmd'),
    join(appData, 'npm', 'kilocode.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'kilo.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'kilo.cmd'),
  ]

  if (candidates.some((path) => existsSync(path))) {
    return true
  }

  return hasWindowsCommandOnPath(['kilo', 'kilocode'])
}

const countServers = (path: string): number => {
  if (!existsSync(path)) return 0

  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as KiloConfig
    return Object.keys(raw.mcp ?? {}).length
  } catch {
    return 0
  }
}

export const kiloCliAdapter: ClientAdapter = {
  id: 'kilo-cli',
  displayName: 'Kilo CLI',
  schemaKey: 'mcp',

  detect(): Promise<ClientDetectionResult> {
    const paths: string[] = []
    const globalPath = globalConfigPath()
    if (existsSync(globalPath)) {
      paths.push(globalPath)
    }
    paths.push(...projectConfigPaths())

    const serverCount = paths.reduce((sum, path) => sum + countServers(path), 0)
    const installed = paths.length > 0 || isKiloCliInstalled()

    log.debug(
      `[kilo-cli] detect: installed=${installed}, paths=${paths.length}, servers=${serverCount}`,
    )

    return Promise.resolve({
      installed,
      configPaths: paths,
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})

    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as KiloConfig
    return Promise.resolve((raw.mcp ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: KiloConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as KiloConfig
    }

    const merged: KiloConfig = { ...existing, mcp: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[kilo-cli] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as KiloConfig
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
