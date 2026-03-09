/**
 * @file src/main/clients/vscode-insiders.adapter.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for Visual Studio Code Insiders. Uses the
 * `servers` schema key and writes to `%APPDATA%\\Code - Insiders\\User\\mcp.json`
 * on Windows.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'
import { hasWindowsCommandOnPath } from './windows-detection.util'

interface VsCodeInsidersConfig {
  servers?: Record<string, unknown>
  [key: string]: unknown
}

const configPath = (): string =>
  join(process.env['APPDATA'] ?? '', 'Code - Insiders', 'User', 'mcp.json')

const isVsCodeInsidersInstalled = (): boolean => {
  if (process.platform !== 'win32') return false

  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'

  const candidates = [
    join(localAppData, 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    join(localAppData, 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'),
    join(localAppData, 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.exe'),
    join(programFiles, 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    join(programFiles, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'),
    join(programFiles, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.exe'),
    join(programFilesX86, 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    join(programFilesX86, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'),
    join(programFilesX86, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.exe'),
  ]

  if (candidates.some((path) => existsSync(path))) {
    return true
  }

  return hasWindowsCommandOnPath(['code-insiders'])
}

export const vscodeInsidersAdapter: ClientAdapter = {
  id: 'vscode-insiders',
  displayName: 'VS Code Insiders',
  schemaKey: 'servers',

  detect(): Promise<ClientDetectionResult> {
    const path = configPath()
    const hasConfig = existsSync(path)
    const installed = hasConfig || isVsCodeInsidersInstalled()
    let serverCount = 0

    if (hasConfig) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as VsCodeInsidersConfig
        serverCount = Object.keys(raw.servers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(`[vscode-insiders] detect: installed=${installed}, servers=${serverCount}`)

    return Promise.resolve({
      installed,
      configPaths: hasConfig ? [path] : [],
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})

    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as VsCodeInsidersConfig
    return Promise.resolve((raw.servers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: VsCodeInsidersConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as VsCodeInsidersConfig
    }

    const merged: VsCodeInsidersConfig = { ...existing, servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[vscode-insiders] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as VsCodeInsidersConfig

      if (raw.servers !== undefined && typeof raw.servers !== 'object') {
        return Promise.resolve({ valid: false, errors: ['servers must be an object'] })
      }

      return Promise.resolve({ valid: true, errors: [] })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.resolve({ valid: false, errors: [`JSON parse error: ${message}`] })
    }
  },
}
