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
import type {
  ClientDetectionResult,
  McpServerConfig,
  McpServerMap,
  ValidationResult,
} from '@shared/types'
import { detectRecentWorkspaces } from '@main/rules/workspace-detector'
import { hasWindowsCommandOnPath } from './windows-detection.util'

interface OpenCodeConfig {
  mcp?: Record<string, unknown>
  [key: string]: unknown
}

type OpenCodeTransport = 'sse' | 'streamable-http'

interface OpenCodeLocalServer {
  type: 'local'
  command: string[]
  environment?: Record<string, string>
  enabled?: boolean
}

interface OpenCodeRemoteServer {
  type: 'remote'
  url: string
  transport?: OpenCodeTransport
  headers?: Record<string, string>
  enabled?: boolean
}

type OpenCodeServer = OpenCodeLocalServer | OpenCodeRemoteServer | Record<string, unknown>

const userHome = (): string => process.env['USERPROFILE'] ?? process.env['HOME'] ?? ''

const globalConfigPath = (): string => join(userHome(), '.config', 'opencode', 'opencode.json')

const isOpenCodeInstalled = (): boolean => {
  if (process.platform !== 'win32') return false

  const appData = process.env['APPDATA'] ?? ''
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const candidates = [
    join(appData, 'npm', 'opencode.cmd'),
    join(appData, 'npm', 'opencode.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'opencode.exe'),
    join(localAppData, 'Microsoft', 'WindowsApps', 'opencode.cmd'),
  ]

  if (candidates.some((path) => existsSync(path))) {
    return true
  }

  return hasWindowsCommandOnPath(['opencode'])
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

const asObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const asStringRecord = (value: unknown): Record<string, string> | undefined => {
  const obj = asObject(value)
  if (!obj) return undefined

  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      result[k] = v
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

const asStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null
  if (!value.every((item) => typeof item === 'string')) return null
  return [...value]
}

const parseLegacyServer = (raw: Record<string, unknown>): McpServerConfig | null => {
  const type = raw['type']
  const url = typeof raw['url'] === 'string' ? raw['url'].trim() : ''
  const command = typeof raw['command'] === 'string' ? raw['command'].trim() : ''
  const args = asStringArray(raw['args']) ?? []
  const env = asStringRecord(raw['env'])
  const headers = asStringRecord(raw['headers'])

  if (type === 'sse' || type === 'http') {
    if (url.length === 0) return null
    return {
      command: command.length > 0 ? command : 'fetch',
      ...(args.length > 0 ? { args } : {}),
      ...(env ? { env } : {}),
      ...(headers ? { headers } : {}),
      type,
      url,
    }
  }

  if (command.length === 0) return null
  return {
    command,
    ...(args.length > 0 ? { args } : {}),
    ...(env ? { env } : {}),
    ...(headers ? { headers } : {}),
  }
}

const parseOpenCodeServer = (rawEntry: unknown): McpServerConfig | null => {
  const raw = asObject(rawEntry)
  if (!raw) return null

  if (raw['type'] === 'local') {
    const commandArray = asStringArray(raw['command'])
    if (!commandArray || commandArray.length === 0) return null

    const command = commandArray[0]?.trim() ?? ''
    if (command.length === 0) return null

    const args = commandArray.slice(1)
    const environment = asStringRecord(raw['environment']) ?? asStringRecord(raw['env'])

    return {
      command,
      ...(args.length > 0 ? { args } : {}),
      ...(environment ? { env: environment } : {}),
    }
  }

  if (raw['type'] === 'remote') {
    const url = typeof raw['url'] === 'string' ? raw['url'].trim() : ''
    if (url.length === 0) return null

    const transport = raw['transport']
    const type = transport === 'sse' ? 'sse' : 'http'
    const headers = asStringRecord(raw['headers'])

    return {
      command: 'fetch',
      type,
      url,
      ...(headers ? { headers } : {}),
    }
  }

  // Backward compatibility with older OpenCode shape.
  return parseLegacyServer(raw)
}

const toOpenCodeServer = (config: McpServerConfig): OpenCodeServer => {
  const type = config.type ?? 'stdio'

  if (type === 'stdio') {
    return {
      type: 'local',
      command: [config.command, ...(config.args ?? [])],
      ...(config.env && Object.keys(config.env).length > 0
        ? { environment: { ...config.env } }
        : {}),
      enabled: true,
    }
  }

  return {
    type: 'remote',
    url: config.url ?? '',
    ...(config.headers && Object.keys(config.headers).length > 0
      ? { headers: { ...config.headers } }
      : {}),
    transport: type === 'sse' ? 'sse' : 'streamable-http',
    enabled: true,
  }
}

const fromOpenCodeMap = (mcp: Record<string, unknown>): McpServerMap => {
  const result: Record<string, McpServerConfig> = {}
  for (const [name, entry] of Object.entries(mcp)) {
    const parsed = parseOpenCodeServer(entry)
    if (parsed) {
      result[name] = parsed
    }
  }
  return result
}

const validateOpenCodeEntry = (name: string, rawEntry: unknown): string | null => {
  const parsed = parseOpenCodeServer(rawEntry)
  if (!parsed) {
    return `mcp.${name} has invalid server shape`
  }

  const raw = asObject(rawEntry)
  if (!raw) return `mcp.${name} must be an object`

  // New shape validations for explicit OpenCode server types.
  if (raw['type'] === 'local') {
    const command = asStringArray(raw['command'])
    if (!command || command.length === 0) {
      return `mcp.${name}.command must be a non-empty string array for local servers`
    }
  }

  if (raw['type'] === 'remote') {
    if (typeof raw['url'] !== 'string' || raw['url'].trim().length === 0) {
      return `mcp.${name}.url must be a non-empty string for remote servers`
    }
  }

  return null
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
    return Promise.resolve(fromOpenCodeMap(raw.mcp ?? {}))
  },

  write(configPath: string, servers: McpServerMap): Promise<void> {
    mkdirSync(dirname(configPath), { recursive: true })

    let existing: OpenCodeConfig = {}
    if (existsSync(configPath)) {
      existing = JSON.parse(readFileSync(configPath, 'utf-8')) as OpenCodeConfig
    }

    const transformedServers: Record<string, OpenCodeServer> = {}
    for (const [name, config] of Object.entries(servers)) {
      transformedServers[name] = toOpenCodeServer(config)
    }

    const merged: OpenCodeConfig = { ...existing, mcp: transformedServers }
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
      if (raw.mcp !== undefined && !asObject(raw.mcp)) {
        return Promise.resolve({ valid: false, errors: ['mcp must be an object'] })
      }

      if (raw.mcp) {
        const errors: string[] = []
        for (const [name, entry] of Object.entries(raw.mcp)) {
          const entryError = validateOpenCodeEntry(name, entry)
          if (entryError) {
            errors.push(entryError)
          }
        }
        if (errors.length > 0) {
          return Promise.resolve({ valid: false, errors })
        }
      }

      return Promise.resolve({ valid: true, errors: [] })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Promise.resolve({ valid: false, errors: [`JSON parse error: ${message}`] })
    }
  },
}
