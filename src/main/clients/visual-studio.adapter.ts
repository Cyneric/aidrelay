/**
 * @file src/main/clients/visual-studio.adapter.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Client adapter for Microsoft Visual Studio. Uses `mcp.json`
 * with a `servers` key and supports a user-configured config path via settings.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { ClientAdapter } from './types'
import type { ClientDetectionResult, McpServerMap, ValidationResult } from '@shared/types'
import { getDatabase } from '@main/db/connection'
import { SettingsRepo } from '@main/db/settings.repo'

interface VisualStudioConfig {
  servers?: Record<string, unknown>
  [key: string]: unknown
}

const VISUAL_STUDIO_CONFIG_SETTING_KEY = 'clients.visualStudio.configPath'

const configuredPath = (): string | null => {
  try {
    const repo = new SettingsRepo(getDatabase())
    const value = repo.get<string>(VISUAL_STUDIO_CONFIG_SETTING_KEY)
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  } catch {
    return null
  }
}

const knownConfigPathCandidates = (): string[] => {
  const appData = process.env['APPDATA'] ?? ''
  const userProfile = process.env['USERPROFILE'] ?? ''
  return [
    join(appData, 'VisualStudio', 'mcp.json'),
    join(appData, 'Microsoft', 'VisualStudio', 'mcp.json'),
    join(userProfile, 'Documents', 'Visual Studio 2022', 'mcp.json'),
  ]
}

const isVisualStudioInstalled = (): boolean => {
  if (process.platform !== 'win32') return false

  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const editions = ['Community', 'Professional', 'Enterprise', 'Preview']

  const candidates: string[] = []
  for (const root of [programFiles, programFilesX86]) {
    for (const edition of editions) {
      candidates.push(
        join(root, 'Microsoft Visual Studio', '2022', edition, 'Common7', 'IDE', 'devenv.exe'),
      )
      candidates.push(
        join(root, 'Microsoft Visual Studio', '2019', edition, 'Common7', 'IDE', 'devenv.exe'),
      )
    }
  }

  return candidates.some((path) => existsSync(path))
}

const dedupe = (values: readonly string[]): string[] =>
  values.filter((value, index, array) => array.indexOf(value) === index)

export const visualStudioAdapter: ClientAdapter = {
  id: 'visual-studio',
  displayName: 'Visual Studio',
  schemaKey: 'servers',

  detect(): Promise<ClientDetectionResult> {
    const configured = configuredPath()
    const candidates = dedupe([...(configured ? [configured] : []), ...knownConfigPathCandidates()])
    const existingPaths = candidates.filter((path) => existsSync(path))
    const installed = existingPaths.length > 0 || isVisualStudioInstalled()
    let serverCount = 0

    for (const path of existingPaths) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8')) as VisualStudioConfig
        serverCount += Object.keys(raw.servers ?? {}).length
      } catch {
        // Ignore malformed files in detect; validate() reports the details.
      }
    }

    log.debug(
      `[visual-studio] detect: installed=${installed}, paths=${existingPaths.length}, servers=${serverCount}`,
    )

    return Promise.resolve({
      installed,
      configPaths: existingPaths,
      serverCount,
    })
  },

  read(configPath: string): Promise<McpServerMap> {
    if (!existsSync(configPath)) return Promise.resolve({})
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as VisualStudioConfig
    return Promise.resolve((raw.servers ?? {}) as McpServerMap)
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: VisualStudioConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as VisualStudioConfig
    }

    const merged: VisualStudioConfig = { ...existing, servers }
    const tmpPath = `${configPath}.aidrelay.tmp`

    writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    renameSync(tmpPath, configPath)

    log.info(`[visual-studio] wrote ${Object.keys(servers).length} server(s) to ${configPath}`)
    return Promise.resolve()
  },

  validate(configPath: string): Promise<ValidationResult> {
    if (!existsSync(configPath)) {
      return Promise.resolve({ valid: false, errors: [`Config file not found: ${configPath}`] })
    }

    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as VisualStudioConfig
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

export { VISUAL_STUDIO_CONFIG_SETTING_KEY }
