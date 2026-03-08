/**
 * @file src/main/ipc/__tests__/clients.ipc.test.ts
 *
 * @description Unit tests for clients IPC handlers:
 * - fallback config-path resolution for config-less installed clients
 * - sync-all inclusion for fallback-capable clients
 * - detect-all sync status derivation from activity log sync events
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import type { ClientAdapter } from '@main/clients/types'
import type { ClientId, ClientStatus, SyncResult } from '@shared/types'
import { createTestDb } from '@main/db/__tests__/helpers'

const handlers: Record<string, (...args: unknown[]) => unknown> = {}
const syncCalls: Array<{ clientId: ClientId; configPath: string }> = []

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
  'codex-cli': { installed: false, configPaths: [], serverCount: 0 },
  'codex-gui': { installed: false, configPaths: [], serverCount: 0 },
  opencode: { installed: false, configPaths: [], serverCount: 0 },
  'visual-studio': { installed: false, configPaths: [], serverCount: 0 },
}

const makeAdapter = (id: ClientId, displayName: string): ClientAdapter => ({
  id,
  displayName,
  schemaKey: 'mcpServers',
  detect: () => Promise.resolve(detectionById[id]),
  read: () => Promise.resolve({}),
  write: () => Promise.resolve(undefined),
  validate: () => Promise.resolve({ valid: true, errors: [] }),
})

const ADAPTER_IDS: readonly ClientId[] = [
  'vscode',
  'vscode-insiders',
  'codex-cli',
  'codex-gui',
  'opencode',
  'visual-studio',
  'cursor',
]
const ADAPTERS = new Map<ClientId, ClientAdapter>([
  ['vscode', makeAdapter('vscode', 'VS Code')],
  ['vscode-insiders', makeAdapter('vscode-insiders', 'VS Code Insiders')],
  ['codex-cli', makeAdapter('codex-cli', 'Codex CLI')],
  ['codex-gui', makeAdapter('codex-gui', 'Codex GUI')],
  ['opencode', makeAdapter('opencode', 'OpenCode')],
  ['visual-studio', makeAdapter('visual-studio', 'Visual Studio')],
  ['cursor', makeAdapter('cursor', 'Cursor')],
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

describe('clients IPC handlers', () => {
  beforeEach(async () => {
    testDb = createTestDb()
    syncCalls.length = 0
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

  it('clients:sync requires confirmation before creating missing config', async () => {
    detectionById['codex-cli'] = { installed: true, configPaths: [], serverCount: 0 }

    const result = await call<SyncResult>('clients:sync', 'codex-cli')

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('config_creation_required')
    expect(syncCalls).toHaveLength(0)
  })

  it('clients:sync resolves fallback path for installed vscode-insiders with no config file', async () => {
    detectionById['vscode-insiders'] = { installed: true, configPaths: [], serverCount: 0 }

    const result = await call<SyncResult>('clients:sync', 'vscode-insiders', {
      allowCreateConfigIfMissing: true,
    })

    expect(result.success).toBe(true)
    expect(syncCalls).toContainEqual({
      clientId: 'vscode-insiders',
      configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Code - Insiders\\User\\mcp.json',
    })
  })

  it('clients:sync writes fallback config when creation is confirmed', async () => {
    detectionById['codex-cli'] = { installed: true, configPaths: [], serverCount: 0 }

    const result = await call<SyncResult>('clients:sync', 'codex-cli', {
      allowCreateConfigIfMissing: true,
    })

    expect(result.success).toBe(true)
    expect(syncCalls).toContainEqual({
      clientId: 'codex-cli',
      configPath: 'C:\\Users\\tester\\.codex\\config.json',
    })
  })

  it('clients:sync uses visual studio path from settings when configured', async () => {
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

  it('clients:sync requires confirmation when visual studio path is not configured', async () => {
    detectionById['visual-studio'] = { installed: true, configPaths: [], serverCount: 0 }

    const result = await call<SyncResult>('clients:sync', 'visual-studio')

    expect(result.success).toBe(false)
    expect(result.errorCode).toBeUndefined()
  })

  it('clients:sync-all includes fallback-capable installed clients without config paths', async () => {
    detectionById['vscode'] = { installed: true, configPaths: [], serverCount: 0 }
    detectionById['vscode-insiders'] = { installed: true, configPaths: [], serverCount: 0 }
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

    expect(results).toHaveLength(7)
    expect(syncCalls).toEqual([
      {
        clientId: 'vscode',
        configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Code\\User\\mcp.json',
      },
      {
        clientId: 'vscode-insiders',
        configPath: 'C:\\Users\\tester\\AppData\\Roaming\\Code - Insiders\\User\\mcp.json',
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
  })
})
