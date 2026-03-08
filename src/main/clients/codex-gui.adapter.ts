/**
 * @file src/main/clients/codex-gui.adapter.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Client adapter for Codex GUI. Detection supports fresh installs
 * where the app executable exists before any MCP config file is created.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { execFileSync } from 'child_process'
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
 * Detects Codex installed via Microsoft Store by querying AppX registration.
 */
const hasCodexWindowsStorePackage = (): boolean => {
  if (process.platform !== 'win32') return false

  try {
    const defaultPowerShellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    const systemRoot = process.env['SystemRoot'] ?? 'C:\\Windows'
    const powerShellPath = join(
      systemRoot,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    )
    const executable = existsSync(powerShellPath) ? powerShellPath : defaultPowerShellPath
    const command = [
      '$pkg = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue |',
      'Select-Object -First 1 Name, Status;',
      'if ($null -eq $pkg) { "" } else { $pkg | ConvertTo-Json -Compress }',
    ].join(' ')

    const raw = execFileSync(executable, ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf-8',
      timeout: 2000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    if (raw.length === 0) return false

    const parsed = JSON.parse(raw) as { Status?: string }
    return parsed.Status?.toLowerCase() === 'ok'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.debug(`[codex-gui] appx detection failed: ${message}`)
    return false
  }
}

/**
 * Checks common Codex GUI installation locations.
 * Intentionally avoids generic PATH aliases to keep CLI and GUI detection separate.
 */
const hasCodexGuiExecutable = (): boolean => {
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

  return candidates.some((path) => existsSync(path))
}

type CodexGuiDetectionSource = 'config' | 'appx' | 'exe' | 'none'

const detectInstallSource = (hasConfig: boolean): CodexGuiDetectionSource => {
  if (hasConfig) return 'config'
  if (hasCodexWindowsStorePackage()) return 'appx'
  if (hasCodexGuiExecutable()) return 'exe'
  return 'none'
}

export const codexGuiAdapter: ClientAdapter = {
  id: 'codex-gui',
  displayName: 'Codex GUI',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const existingConfig = resolveExistingConfigPath()
    const source = detectInstallSource(existingConfig !== undefined)
    const installed = source !== 'none'
    let serverCount = 0

    if (existingConfig) {
      try {
        const raw = JSON.parse(readFileSync(existingConfig, 'utf-8')) as CodexGuiConfig
        serverCount = Object.keys(raw.mcpServers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(
      `[codex-gui] detect: installed=${installed}, source=${source}, servers=${serverCount}`,
    )

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
