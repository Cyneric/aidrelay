/**
 * @file src/main/ipc/servers.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for all server-related channels. Wires the renderer
 * to the `ServersRepo` for CRUD operations and writes activity log entries for
 * every state-changing action so the history page stays accurate.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { McpServer } from '@shared/types'
import type { CreateServerInput, UpdateServerInput } from '@shared/channels'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'

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

  log.info('[ipc] servers handlers registered')
}
