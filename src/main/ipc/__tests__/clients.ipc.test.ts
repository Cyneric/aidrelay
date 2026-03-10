/**
 * @file src/main/ipc/__tests__/clients.ipc.test.ts
 *
 * @description Unit tests for clients IPC handlers:
 * - fallback config-path resolution for config-less installed clients
 * - install channel wiring
 * - manual path set/clear + detect/read/sync/validate precedence
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'path'
import type Database from 'better-sqlite3'
import type { ClientAdapter } from '@main/clients/types'
import { ServersRepo } from '@main/db/servers.repo'
import type { ClientInstallProgressPayload } from '@shared/channels'
import type {
  ClientId,
  ClientInstallResult,
  ClientStatus,
  ConfigChangedPayload,
  ConfigImportPreviewResult,
  ConfigImportResult,
  McpServerMap,
  SyncResult,
  ValidationResult,
} from '@shared/types'
import { createTestDb } from '@main/db/__tests__/helpers'

const handlers: Record<string, (...args: unknown[]) => unknown> = {}
const syncCalls: Array<{ clientId: ClientId; configPath: string }> = []
const readCalls: Array<{ clientId: ClientId; configPath: string }> = []
const validateCalls: Array<{ clientId: ClientId; configPath: string }> = []

const installMock = vi.hoisted(() =>
  vi.fn<
    (
      clientId: ClientId,
      reportProgress?: (payload: ClientInstallProgressPayload) => void,
    ) => Promise<ClientInstallResult>
  >(),
)

const detectionById: Record<
  ClientId,
  { installed: boolean; configPaths: readonly string[]; serverCount: number }
> = {
  'claude-desktop': { installed: false, configPaths: [], serverCount: 0 },
  'claude-code': { installed: false, configPaths: [], serverCount: 0 },
  cursor: { installed: false, configPaths: [], serverCount: 0 },
  vscode: { installed: false, configPaths: [], serverCount: 0 },
  'vscode-insiders': { installed: false, configPaths: [], serverCount: 0 },
  windsurf: { installed: false, configPaths: [], serverCount: 0 },
  zed: { installed: false, configPaths: [], serverCount: 0 },
  jetbrains: { installed: false, configPaths: [], serverCount: 0 },
  'gemini-cli': { installed: false, configPaths: [], serverCount: 0 },
  'codex-cli': { installed: false, configPaths: [], serverCount: 0 },
  'codex-gui': { installed: false, configPaths: [], serverCount: 0 },
  opencode: { installed: false, configPaths: [], serverCount: 0 },
  'visual-studio': { installed: false, configPaths: [], serverCount: 0 },
}

const readByPath = new Map<string, McpServerMap>()
const validationByPath = new Map<string, ValidationResult>()

const makeAdapter = (id: ClientId, displayName: string): ClientAdapter => ({
  id,
  displayName,
  schemaKey: 'mcpServers',
  detect: () => Promise.resolve(detectionById[id]),
  read: (configPath: string) => {
    readCalls.push({ clientId: id, configPath })
    return Promise.resolve(readByPath.get(configPath) ?? {})
  },
  write: () => Promise.resolve(undefined),
  validate: (configPath: string) => {
    validateCalls.push({ clientId: id, configPath })
    return Promise.resolve(validationByPath.get(configPath) ?? { valid: true, errors: [] })
  },
})

const ADAPTER_IDS: readonly ClientId[] = [
  'vscode',
  'vscode-insiders',
  'gemini-cli',
  'codex-cli',
  'codex-gui',
  'opencode',
  'visual-studio',
  'cursor',
  'jetbrains',
]
const ADAPTERS = new Map<ClientId, ClientAdapter>([
  ['vscode', makeAdapter('vscode', 'VS Code')],
  ['vscode-insiders', makeAdapter('vscode-insiders', 'VS Code Insiders')],
  ['gemini-cli', makeAdapter('gemini-cli', 'Gemini CLI')],
  ['codex-cli', makeAdapter('codex-cli', 'Codex CLI')],
  ['codex-gui', makeAdapter('codex-gui', 'Codex GUI')],
  ['opencode', makeAdapter('opencode', 'OpenCode')],
  ['visual-studio', makeAdapter('visual-studio', 'Visual Studio')],
  ['cursor', makeAdapter('cursor', 'Cursor')],
  ['jetbrains', makeAdapter('jetbrains', 'JetBrains')],
])

let testDb: Database.Database

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn
    },
  },
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@main/clients/registry', () => ({
  ADAPTERS,
  ADAPTER_IDS,
}))

vi.mock('@main/clients/client-install.service', () => ({
  ClientInstallService: class {
    install(
      clientId: ClientId,
      reportProgress?: (payload: ClientInstallProgressPayload) => void,
    ): Promise<ClientInstallResult> {
      return installMock(clientId, reportProgress)
    }
  },
}))

vi.mock('@main/db/connection', () => ({
  getDatabase: () => testDb,
}))

vi.mock('@main/sync/sync.service', () => ({
  SyncService: class {
    sync(adapter: ClientAdapter, configPath: string): Promise<SyncResult> {
      syncCalls.push({ clientId: adapter.id, configPath })
      return Promise.resolve({
        clientId: adapter.id,
        success: true,
        serversWritten: 1,
        syncedAt: '2026-03-08T00:00:00.000Z',
      })
    }
  },
}))

const call = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  const handler = handlers[channel]
  if (!handler) throw new Error(`Handler not registered for channel: ${channel}`)
  return (await handler(undefined, ...args)) as T
}

const callWithEvent = async <T>(
  channel: string,
  event: unknown,
  ...args: unknown[]
): Promise<T> => {
  const handler = handlers[channel]
  if (!handler) throw new Error(`Handler not registered for channel: ${channel}`)
  return (await handler(event, ...args)) as T
}

describe('clients IPC handlers', () => {
  beforeEach(async () => {
    testDb = createTestDb()
    syncCalls.length = 0
    readCalls.length = 0
    validateCalls.length = 0
    readByPath.clear()
    validationByPath.clear()
    installMock.mockReset()
    installMock.mockResolvedValue({
      clientId: 'cursor',
      success: true,
      attempts: [],
      installedWith: 'winget',
      message: 'ok',
    })

    for (const id of Object.keys(detectionById) as ClientId[]) {
      detectionById[id] = { installed: false, configPaths: [], serverCount: 0 }
    }

    process.env['APPDATA'] = 'C:\\Users\\tester\\AppData\\Roaming'
    process.env['USERPROFILE'] = 'C:\\Users\\tester'

    vi.resetModules()
    const { registerClientsIpc } = await import('../clients.ipc')
    registerClientsIpc()
  })

  afterEach(() => {
    testDb.close()
  })

  it('clients:install delegates to install service and returns typed payload', async () => {
    const expected: ClientInstallResult = {
      clientId: 'cursor',
      success: false,
      attempts: [],
      failureReason: 'command_failed',
      message: 'failed',
    }
    installMock.mockResolvedValue(expected)

    const send = vi.fn()
    const event = { sender: { send } }
    const result = await callWithEvent<ClientInstallResult>('clients:install', event, 'cursor')

    expect(installMock).toHaveBeenCalledWith('cursor', expect.any(Function))
    expect(result).toEqual(expected)
    expect(send).not.toHaveBeenCalled()
  })

  it('clients:install emits typed progress payloads to requesting renderer only', async () => {
    const progressPayload: ClientInstallProgressPayload = {
      clientId: 'cursor',
      phase: 'manager_running',
      progress: 42,
      attemptIndex: 1,
      attemptCount: 2,
      manager: 'winget',
    }
    installMock.mockImplementation((_clientId, reportProgress) => {
      reportProgress?.(progressPayload)
      return Promise.resolve({
        clientId: 'cursor',
        success: false,
        attempts: [],
        failureReason: 'command_failed',
        message: 'failed',
      })
    })

    const send = vi.fn()
    const event = { sender: { send } }
    await callWithEvent<ClientInstallResult>('clients:install', event, 'cursor')

    expect(send).toHaveBeenCalledWith('clients:install-progress', progressPayload)
  })

  it('clients:sync resolves fallback path for installed vscode with no config file', async () => {
    detectionById['vscode'] = { installed: true, configPaths: [], serverCount: 0 }

    const result = await call<SyncResult>('clients:sync', 'vscode', {
      allowCreateConfigIfMissing: true,
    })

    expect(result.success).toBe(true)
    expect(syncCalls).toHaveLength(1)
    expect(syncCalls[0]).toEqual({
      clientId: 'vscode',
      configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Code\\User\\mcp.json',
    })
  })

  it('clients:sync resolves fallback path for installed visual studio with no config file', async () => {
    detectionById['visual-studio'] = { installed: true, configPaths: [], serverCount: 0 }

    const result = await call<SyncResult>('clients:sync', 'visual-studio', {
      allowCreateConfigIfMissing: true,
    })

    expect(result.success).toBe(true)
    expect(syncCalls).toContainEqual({
      clientId: 'visual-studio',
      configPath: 'C:\\Users\\tester\\AppData\\Roaming\\VisualStudio\\mcp.json',
    })
  })

  it('clients:sync requires confirmation before creating missing config', async () => {
    detectionById['gemini-cli'] = { installed: true, configPaths: [], serverCount: 0 }

    const result = await call<SyncResult>('clients:sync', 'gemini-cli')

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('config_creation_required')
    expect(syncCalls).toHaveLength(0)
  })

  it('clients:sync uses visual studio legacy path from settings when configured', async () => {
    detectionById['visual-studio'] = { installed: true, configPaths: [], serverCount: 0 }
    testDb
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      .run('clients.visualStudio.configPath', JSON.stringify('C:\\Users\\tester\\vs\\mcp.json'))

    const result = await call<SyncResult>('clients:sync', 'visual-studio', {
      allowCreateConfigIfMissing: true,
    })

    expect(result.success).toBe(true)
    expect(syncCalls).toContainEqual({
      clientId: 'visual-studio',
      configPath: 'C:\\Users\\tester\\vs\\mcp.json',
    })
  })

  it('clients:set-manual-config-path validates and persists discovered path', async () => {
    const manualPath = join(process.cwd(), 'package.json')

    const validation = await call<ValidationResult>(
      'clients:set-manual-config-path',
      'cursor',
      manualPath,
    )

    expect(validation).toEqual({ valid: true, errors: [] })
    expect(validateCalls).toContainEqual({ clientId: 'cursor', configPath: manualPath })

    const stored = testDb
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('clients.manualConfigPath.cursor') as { value: string }
    expect(JSON.parse(stored.value)).toBe(manualPath)
  })

  it('manual config override takes precedence in detect/read/sync/validate', async () => {
    const autoPath = 'C:\\auto\\cursor.json'
    const manualPath = join(process.cwd(), 'package.json')
    detectionById['cursor'] = { installed: true, configPaths: [autoPath], serverCount: 4 }

    readByPath.set(manualPath, {
      alpha: { command: 'node', args: ['a.js'] },
      beta: { command: 'node', args: ['b.js'] },
    })

    await call<ValidationResult>('clients:set-manual-config-path', 'cursor', manualPath)
    readCalls.length = 0
    validateCalls.length = 0

    const detected = await call<ClientStatus[]>('clients:detect-all')
    const cursor = detected.find((entry) => entry.id === 'cursor')
    expect(cursor?.manualConfigPath).toBe(manualPath)
    expect(cursor?.configPaths).toEqual([manualPath])
    expect(cursor?.serverCount).toBe(2)

    await call<McpServerMap>('clients:read-config', 'cursor')
    expect(readCalls).toContainEqual({ clientId: 'cursor', configPath: manualPath })
    expect(readCalls).not.toContainEqual({ clientId: 'cursor', configPath: autoPath })

    await call<SyncResult>('clients:sync', 'cursor')
    expect(syncCalls).toContainEqual({ clientId: 'cursor', configPath: manualPath })
    expect(syncCalls).not.toContainEqual({ clientId: 'cursor', configPath: autoPath })

    await call<ValidationResult>('clients:validate-config', 'cursor')
    expect(validateCalls).toContainEqual({ clientId: 'cursor', configPath: manualPath })
  })

  it('clients:clear-manual-config-path removes override and falls back to adapter detection', async () => {
    const autoPath = 'C:\\auto\\cursor.json'
    const manualPath = join(process.cwd(), 'package.json')
    detectionById['cursor'] = { installed: true, configPaths: [autoPath], serverCount: 4 }

    await call<ValidationResult>('clients:set-manual-config-path', 'cursor', manualPath)
    await call<void>('clients:clear-manual-config-path', 'cursor')

    const detected = await call<ClientStatus[]>('clients:detect-all')
    const cursor = detected.find((entry) => entry.id === 'cursor')
    expect(cursor?.manualConfigPath).toBeUndefined()
    expect(cursor?.configPaths).toEqual([autoPath])

    const stored = testDb
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('clients.manualConfigPath.cursor')
    expect(stored).toBeUndefined()
  })

  it('clients:sync-all includes fallback-capable installed clients without config paths', async () => {
    detectionById['vscode'] = { installed: true, configPaths: [], serverCount: 0 }
    detectionById['vscode-insiders'] = { installed: true, configPaths: [], serverCount: 0 }
    detectionById['gemini-cli'] = { installed: true, configPaths: [], serverCount: 0 }
    detectionById['codex-cli'] = { installed: true, configPaths: [], serverCount: 0 }
    detectionById['codex-gui'] = { installed: true, configPaths: [], serverCount: 0 }
    detectionById['opencode'] = { installed: true, configPaths: [], serverCount: 0 }
    detectionById['visual-studio'] = {
      installed: true,
      configPaths: ['C:\\Users\\tester\\Documents\\vs-mcp.json'],
      serverCount: 0,
    }
    detectionById['cursor'] = {
      installed: true,
      configPaths: ['C:\\Users\\tester\\.cursor\\mcp.json'],
      serverCount: 0,
    }

    const results = await call<SyncResult[]>('clients:sync-all')

    expect(results).toHaveLength(8)
    expect(syncCalls).toEqual([
      {
        clientId: 'vscode',
        configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Code\\User\\mcp.json',
      },
      {
        clientId: 'vscode-insiders',
        configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Code - Insiders\\User\\mcp.json',
      },
      {
        clientId: 'gemini-cli',
        configPath: 'C:\\Users\\tester\\.gemini\\settings.json',
      },
      { clientId: 'codex-cli', configPath: 'C:\\Users\\tester\\.codex\\config.json' },
      {
        clientId: 'codex-gui',
        configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Codex\\config.json',
      },
      {
        clientId: 'opencode',
        configPath: 'C:\\Users\\tester\\.config\\opencode\\opencode.json',
      },
      {
        clientId: 'visual-studio',
        configPath: 'C:\\Users\\tester\\Documents\\vs-mcp.json',
      },
      { clientId: 'cursor', configPath: 'C:\\Users\\tester\\.cursor\\mcp.json' },
    ])
  })

  it('clients:detect-all derives syncStatus from latest sync event', async () => {
    detectionById['vscode'] = {
      installed: true,
      configPaths: ['C:\\tmp\\vscode.json'],
      serverCount: 1,
    }
    detectionById['cursor'] = {
      installed: true,
      configPaths: ['C:\\tmp\\cursor.json'],
      serverCount: 2,
    }
    detectionById['codex-cli'] = { installed: true, configPaths: [], serverCount: 0 }
    detectionById['gemini-cli'] = { installed: true, configPaths: [], serverCount: 0 }

    testDb
      .prepare(
        `INSERT INTO activity_log (timestamp, action, details, client_id, server_id)
         VALUES (?, ?, ?, ?, NULL)`,
      )
      .run('2026-03-08T10:00:00.000Z', 'sync.performed', '{}', 'cursor')
    testDb
      .prepare(
        `INSERT INTO activity_log (timestamp, action, details, client_id, server_id)
         VALUES (?, ?, ?, ?, NULL)`,
      )
      .run('2026-03-08T10:01:00.000Z', 'sync.failed', '{"error":"boom"}', 'vscode')

    const results = await call<ClientStatus[]>('clients:detect-all')
    const byId = new Map(results.map((r) => [r.id, r]))

    expect(byId.get('cursor')?.syncStatus).toBe('synced')
    expect(byId.get('cursor')?.lastSyncedAt).toBe('2026-03-08T10:00:00.000Z')
    expect(byId.get('vscode')?.syncStatus).toBe('error')
    expect(byId.get('codex-cli')?.syncStatus).toBe('never-synced')
    expect(byId.get('gemini-cli')?.syncStatus).toBe('never-synced')
  })

  it('clients:preview-config-import classifies create/overwrite/removed items', async () => {
    const configPath = 'C:\\tmp\\cursor.json'
    const repo = new ServersRepo(testDb)
    repo.create({
      name: 'alpha',
      type: 'stdio',
      command: 'node',
      args: ['old.js'],
    })
    repo.create({
      name: 'gamma',
      type: 'stdio',
      command: 'node',
      args: ['keep.js'],
    })

    readByPath.set(configPath, {
      alpha: { command: 'node', args: ['new.js'] },
      beta: { command: 'npx', args: ['-y', '@scope/server-beta'] },
    })

    const payload: ConfigChangedPayload = {
      clientId: 'cursor',
      configPath,
      added: ['beta'],
      removed: ['gamma'],
      modified: ['alpha'],
    }

    const preview = await call<ConfigImportPreviewResult>('clients:preview-config-import', payload)
    const byName = new Map(preview.items.map((item) => [item.name, item]))

    expect(byName.get('alpha')?.action).toBe('overwrite')
    expect(byName.get('beta')?.action).toBe('create')
    expect(byName.get('gamma')?.action).toBe('removed_external')
  })

  it('clients:import-config-changes overwrites existing, creates new, and keeps removed external', async () => {
    const configPath = 'C:\\tmp\\cursor.json'
    const repo = new ServersRepo(testDb)
    repo.create({
      name: 'alpha',
      type: 'stdio',
      command: 'node',
      args: ['old.js'],
    })
    repo.create({
      name: 'gamma',
      type: 'stdio',
      command: 'node',
      args: ['keep.js'],
    })

    readByPath.set(configPath, {
      alpha: { command: 'node', args: ['new.js'] },
      beta: { command: 'npx', args: ['-y', '@scope/server-beta'] },
    })

    const payload: ConfigChangedPayload = {
      clientId: 'cursor',
      configPath,
      added: ['beta'],
      removed: ['gamma'],
      modified: ['alpha'],
    }

    const result = await call<ConfigImportResult>('clients:import-config-changes', payload)
    expect(result.created).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.errors).toEqual([])

    const all = new ServersRepo(testDb).findAll()
    const byName = new Map(all.map((server) => [server.name, server]))

    expect(byName.get('alpha')?.args).toEqual(['new.js'])
    expect(byName.has('beta')).toBe(true)
    expect(byName.has('gamma')).toBe(true)
  })
})
