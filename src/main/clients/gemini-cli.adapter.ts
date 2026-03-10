/**
 * @file src/main/clients/gemini-cli.adapter.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Client adapter for Gemini CLI. Config lives at
 * `%USERPROFILE%\.gemini\settings.json` on Windows. MCP server definitions
 * are stored under top-level `mcpServers`.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import type { ClientAdapter } from './types'
import { hasWindowsCommandOnPath } from './windows-detection.util'

interface GeminiConfig {
  mcpServers?: Record<string, unknown>
  [key: string]: unknown
}

const configPath = (): string => join(process.env['USERPROFILE'] ?? '', '.gemini', 'settings.json')

const isGeminiCliInstalled = (): boolean => {
  if (process.platform !== 'win32') return false

  const appData = process.env['APPDATA'] ?? ''
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const candidates = [
    join(appData, 'npm', 'gemini.cmd'),
    join(appData, 'npm', 'gemini.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'gemini.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'gemini.cmd'),
  ]

  if (candidates.some((path) => existsSync(path))) {
    return true
  }

  return hasWindowsCommandOnPath(['gemini'])
}

export const geminiCliAdapter: ClientAdapter = {
  id: 'gemini-cli',
  displayName: 'Gemini CLI',
  schemaKey: 'mcpServers',

  detect(): Promise<ClientDetectionResult> {
    const path = configPath()
    const hasConfig = existsSync(path)
    const installed = hasConfig || isGeminiCliInstalled()
    let serverCount = 0

    if (hasConfig) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as GeminiConfig
        serverCount = Object.keys(raw.mcpServers ?? {}).length
      } catch {
        serverCount = 0
      }
    }

    log.debug(`[gemini-cli] detect: installed=${installed}, servers=${serverCount}`)

    return Promise.resolve({
      installed,
      configPaths: hasConfig ? [path] : [],
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as GeminiConfig
    return Promise.resolve((raw.mcpServers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: GeminiConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as GeminiConfig
    }

    const merged: GeminiConfig = { ...existing, mcpServers: servers }
    const tmpPath = `${configPath}.aidrelay.tmp`
    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[gemini-cli] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as GeminiConfig
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
