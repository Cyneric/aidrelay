/**
 * @file src/main/ipc/__tests__/servers.ipc.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the servers IPC handlers. Electron's `ipcMain`
 * is mocked so the test environment stays in plain Node.js. The handlers are
 * extracted and invoked directly, while `getDatabase` is replaced with an
 * in-memory SQLite database so no filesystem side effects occur.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { createTestDb } from '@main/db/__tests__/helpers'

// ─── Electron mock ────────────────────────────────────────────────────────────

/** Captured handler map: channel name → handler function. */
const handlers: Record<string, (...args: unknown[]) => unknown> = {}

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

// ─── DB mock ──────────────────────────────────────────────────────────────────

let testDb: Database.Database

vi.mock('@main/db/connection', () => ({
  getDatabase: () => testDb,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calls a registered IPC handler by channel name, simulating what
 * `ipcMain.handle` does when the renderer invokes the channel.
 */
const call = <T>(channel: string, ...args: unknown[]): T => {
  const handler = handlers[channel]
  if (!handler) throw new Error(`Handler not registered for channel: ${channel}`)
  return handler(undefined, ...args) as T
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('servers IPC handlers', () => {
  let serversRepo: ServersRepo
  let logRepo: ActivityLogRepo

  beforeEach(async () => {
    testDb = createTestDb()
    serversRepo = new ServersRepo(testDb)
    logRepo = new ActivityLogRepo(testDb)

    // Import (and therefore register) the handlers fresh for each test
    vi.resetModules()
    const { registerServersIpc } = await import('../servers.ipc')
    registerServersIpc()
  })

  afterEach(() => {
    testDb.close()
  })

  // ─── servers:list ─────────────────────────────────────────────────────────

  it('servers:list returns empty array when no servers exist', () => {
    const result = call<unknown[]>('servers:list')
    expect(result).toEqual([])
  })

  it('servers:list returns all servers after creation', () => {
    serversRepo.create({ name: 'alpha', type: 'stdio', command: 'npx' })
    serversRepo.create({ name: 'beta', type: 'stdio', command: 'npx' })

    const result = call<{ name: string }[]>('servers:list')
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('alpha')
  })

  // ─── servers:get ──────────────────────────────────────────────────────────

  it('servers:get returns null for unknown id', () => {
    expect(call('servers:get', 'does-not-exist')).toBeNull()
  })

  it('servers:get returns the correct server', () => {
    const server = serversRepo.create({ name: 'get-test', type: 'stdio', command: 'node' })
    const result = call<{ id: string; name: string }>('servers:get', server.id)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('get-test')
  })

  // ─── servers:create ───────────────────────────────────────────────────────

  it('servers:create persists the server and logs the action', () => {
    const result = call<{ id: string; name: string }>('servers:create', {
      name: 'created-via-ipc',
      type: 'stdio',
      command: 'npx',
    })

    expect(result.name).toBe('created-via-ipc')
    expect(serversRepo.findById(result.id)).not.toBeNull()

    const logs = logRepo.query({ action: 'server.created' })
    expect(logs).toHaveLength(1)
    expect(logs[0]?.details).toMatchObject({ serverName: 'created-via-ipc' })
  })

  // ─── servers:update ───────────────────────────────────────────────────────

  it('servers:update applies changes and logs the action', () => {
    const server = serversRepo.create({ name: 'to-update', type: 'stdio', command: 'node' })
    const result = call<{ command: string }>('servers:update', server.id, { command: 'python' })

    expect(result.command).toBe('python')

    const logs = logRepo.query({ action: 'server.updated' })
    expect(logs).toHaveLength(1)
  })

  it('servers:update can toggle enabled flag', () => {
    const server = serversRepo.create({ name: 'enable-test', type: 'stdio', command: 'node' })
    const result = call<{ enabled: boolean }>('servers:update', server.id, { enabled: false })

    expect(result.enabled).toBe(false)
  })

  it('servers:update merges clientOverrides without wiping existing entries', () => {
    const server = serversRepo.create({ name: 'override-test', type: 'stdio', command: 'npx' })

    // Set cursor override first
    call('servers:update', server.id, {
      clientOverrides: { cursor: { enabled: false } },
    })

    // Now add vscode override — cursor should still be there
    const result = call<{
      clientOverrides: Record<string, { enabled: boolean }>
    }>('servers:update', server.id, {
      clientOverrides: { vscode: { enabled: false } },
    })

    expect(result.clientOverrides['cursor']).toEqual({ enabled: false })
    expect(result.clientOverrides['vscode']).toEqual({ enabled: false })
  })

  // ─── servers:delete ───────────────────────────────────────────────────────

  it('servers:delete removes the server and logs the action', () => {
    const server = serversRepo.create({ name: 'to-delete', type: 'stdio', command: 'node' })
    call('servers:delete', server.id)

    expect(serversRepo.findById(server.id)).toBeNull()

    const logs = logRepo.query({ action: 'server.deleted' })
    expect(logs).toHaveLength(1)
  })
})
