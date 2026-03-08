/**
 * @file src/main/clients/codex-gui.adapter.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Client adapter for Codex GUI. Detection supports fresh installs
 * where the app executable exists before any MCP config file is created.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import log from 'electron-log'
import type { ClientAdapter } from './types'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'

interface CodexGuiConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

const configPathCandidates = (): string[] => {
  const appData = process.env['APPDATA'] ?? ''
  const localAppData = process.env['LOCALAPPDATA'] ?? ''

  return [
    join(appData, 'Codex', 'config.json'),
    join(appData, 'OpenAI Codex', 'config.json'),
    join(localAppData, 'Codex', 'config.json'),
  ]
}

const resolveExistingConfigPath = (): string | undefined =>
  configPathCandidates().find((path) => existsSync(path))

/**
 * Detects Codex installed via Microsoft Store by checking package executable path.
 */
const hasCodexWindowsStoreExecutable = (): boolean => {
  if (process.platform !== 'win32') return false

  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  const windowsAppsDir = join(programFiles, 'WindowsApps')
  if (!existsSync(windowsAppsDir)) return false

  try {
    return readdirSync(windowsAppsDir)
      .filter((entry) => entry.startsWith('OpenAI.Codex_'))
      .some((entry) => existsSync(join(windowsAppsDir, entry, 'app', 'resources', 'codex.exe')))
  } catch {
    return false
  }
}

/**
 * Checks common Codex GUI installation locations.
 * Intentionally avoids generic PATH aliases to keep CLI and GUI detection separate.
 */
const isCodexGuiInstalled = (): boolean => {
  if (process.platform !== 'win32') return false

  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'

  const candidates = [
    join(localAppData, 'Programs', 'Codex', 'Codex.exe'),
    join(localAppData, 'Codex', 'Codex.exe'),
    join(programFiles, 'Codex', 'Codex.exe'),
    join(programFilesX86, 'Codex', 'Codex.exe'),
    join(localAppData, 'Programs', 'OpenAI Codex', 'Codex.exe'),
    join(programFiles, 'OpenAI Codex', 'Codex.exe'),
    join(programFilesX86, 'OpenAI Codex', 'Codex.exe'),
  ]

  return hasCodexWindowsStoreExecutable() || candidates.some((path) => existsSync(path))
}

export const codexGuiAdapter: ClientAdapter = {
  id: 'codex-gui',
  displayName: 'Codex GUI',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const existingConfig = resolveExistingConfigPath()
    const installed = existingConfig !== undefined || isCodexGuiInstalled()
    let serverCount = 0

    if (existingConfig) {
      try {
        const raw = JSON.parse(readFileSync(existingConfig, 'utf-8')) as CodexGuiConfig
        serverCount = Object.keys(raw.mcpServers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(`[codex-gui] detect: installed=${installed}, servers=${serverCount}`)

    return Promise.resolve({
      installed,
      configPaths: existingConfig ? [existingConfig] : [],
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as CodexGuiConfig
    return Promise.resolve((raw.mcpServers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: CodexGuiConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as CodexGuiConfig
    }

    const merged: CodexGuiConfig = { ...existing, mcpServers: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[codex-gui] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as CodexGuiConfig
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
