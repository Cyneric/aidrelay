/**
 * @file src/main/ipc/servers.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for all server-related channels. Wires the renderer
 * to the `ServersRepo` for CRUD operations and writes activity log entries for
 * every state-changing action so the history page stays accurate.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { McpServer } from '@shared/types'
import type { CreateServerInput, UpdateServerInput, TestResult } from '@shared/channels'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { checkGate } from '@main/licensing/feature-gates'
import { serverTester } from '@main/testing/server-tester.service'

// ─── Service Factory ──────────────────────────────────────────────────────────

/**
 * Creates `ServersRepo` and `ActivityLogRepo` instances backed by the live DB.
 * Called per-handler so there is never stale state from a previous call.
 */
const createRepos = (): { servers: ServersRepo; log: ActivityLogRepo } => {
  const db = getDatabase()
  return { servers: new ServersRepo(db), log: new ActivityLogRepo(db) }
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `servers:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerServersIpc = (): void => {
  // ── servers:list ──────────────────────────────────────────────────────────
  ipcMain.handle('servers:list', (): McpServer[] => {
    log.debug('[ipc] servers:list')
    const { servers } = createRepos()
    return servers.findAll()
  })

  // ── servers:get ───────────────────────────────────────────────────────────
  ipcMain.handle('servers:get', (_event, id: string): McpServer | null => {
    log.debug(`[ipc] servers:get ${id}`)
    const { servers } = createRepos()
    return servers.findById(id)
  })

  // ── servers:create ────────────────────────────────────────────────────────
  ipcMain.handle('servers:create', (_event, input: CreateServerInput): McpServer => {
    log.debug(`[ipc] servers:create "${input.name}"`)
    const { servers, log: logRepo } = createRepos()

    // Enforce the per-tier server limit before creating.
    const maxServers = checkGate('maxServers')
    const currentCount = servers.findAll().length
    if (currentCount >= maxServers) {
      throw new Error(
        `Server limit reached (${maxServers}). Upgrade to aidrelay Pro for unlimited servers.`,
      )
    }

    const server = servers.create(input)
    logRepo.insert({
      action: 'server.created',
      details: { serverName: server.name, serverType: server.type },
      serverId: server.id,
    })
    return server
  })

  // ── servers:update ────────────────────────────────────────────────────────
  ipcMain.handle('servers:update', (_event, id: string, updates: UpdateServerInput): McpServer => {
    log.debug(`[ipc] servers:update ${id}`)
    const { servers, log: logRepo } = createRepos()
    const server = servers.update(id, updates)
    logRepo.insert({
      action: 'server.updated',
      details: { serverName: server.name, updatedFields: Object.keys(updates) },
      serverId: server.id,
    })
    return server
  })

  // ── servers:delete ────────────────────────────────────────────────────────
  ipcMain.handle('servers:delete', (_event, id: string): void => {
    log.debug(`[ipc] servers:delete ${id}`)
    const { servers, log: logRepo } = createRepos()
    const server = servers.findById(id)
    servers.delete(id)
    logRepo.insert({
      action: 'server.deleted',
      details: { serverName: server?.name ?? id },
      serverId: id,
    })
  })

  // ── servers:test ──────────────────────────────────────────────────────────
  ipcMain.handle('servers:test', async (_event, id: string): Promise<TestResult> => {
    log.debug(`[ipc] servers:test ${id}`)

    const allowed = checkGate('serverTesting')
    if (!allowed) {
      throw new Error('Server connection testing requires aidrelay Pro.')
    }

    const { servers } = createRepos()
    const server = servers.findById(id)
    if (!server) {
      return { success: false, message: `Server not found: ${id}` }
    }

    return serverTester.testServer(server)
  })

  log.info('[ipc] servers handlers registered')
}
