/**
 * @file src/main/ipc/clients.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for all client-related channels. Wires the renderer
 * to the adapter registry and the sync service. Every handler is registered with
 * `ipcMain.handle` so the renderer can call it via `ipcRenderer.invoke`.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { ClientId, ClientStatus, McpServerMap, SyncResult } from '@shared/types'
import { ADAPTERS, ADAPTER_IDS } from '@main/clients/registry'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { BackupsRepo } from '@main/db/backups.repo'
import { BackupService } from '@main/sync/backup.service'
import { SyncService } from '@main/sync/sync.service'

// ─── Service Factory ──────────────────────────────────────────────────────────

/**
 * Creates a fully-wired `SyncService` using the live SQLite database.
 * Called once per handler invocation to keep dependencies fresh.
 */
const createSyncService = (): SyncService => {
  const db = getDatabase()
  const serversRepo = new ServersRepo(db)
  const activityLogRepo = new ActivityLogRepo(db)
  const backupsRepo = new BackupsRepo(db)
  const backupService = new BackupService(backupsRepo)
  return new SyncService(serversRepo, activityLogRepo, backupService)
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `clients:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerClientsIpc = (): void => {
  // ── clients:detect-all ────────────────────────────────────────────────────
  ipcMain.handle('clients:detect-all', async (): Promise<ClientStatus[]> => {
    log.debug('[ipc] clients:detect-all')

    const results = await Promise.all(
      ADAPTER_IDS.map(async (id): Promise<ClientStatus> => {
        const adapter = ADAPTERS.get(id)!
        try {
          const detection = await adapter.detect()
          return {
            id,
            displayName: adapter.displayName,
            installed: detection.installed,
            configPaths: detection.configPaths,
            serverCount: detection.serverCount,
            syncStatus: 'never-synced',
          }
        } catch (err) {
          log.warn(`[ipc] detect failed for ${id}: ${String(err)}`)
          return {
            id,
            displayName: adapter.displayName,
            installed: false,
            configPaths: [],
            serverCount: 0,
            syncStatus: 'error',
          }
        }
      }),
    )

    return results
  })

  // ── clients:read-config ───────────────────────────────────────────────────
  ipcMain.handle(
    'clients:read-config',
    async (_event, clientId: ClientId): Promise<McpServerMap> => {
      log.debug(`[ipc] clients:read-config ${clientId}`)

      const adapter = ADAPTERS.get(clientId)
      if (!adapter) return {}

      const detection = await adapter.detect()
      if (!detection.installed || detection.configPaths.length === 0) return {}

      return adapter.read(detection.configPaths[0]!)
    },
  )

  // ── clients:sync ──────────────────────────────────────────────────────────
  ipcMain.handle('clients:sync', async (_event, clientId: ClientId): Promise<SyncResult> => {
    log.debug(`[ipc] clients:sync ${clientId}`)

    const adapter = ADAPTERS.get(clientId)
    if (!adapter) {
      return {
        clientId,
        success: false,
        serversWritten: 0,
        error: `No adapter registered for client: ${clientId}`,
        syncedAt: new Date().toISOString(),
      }
    }

    const detection = await adapter.detect()
    if (!detection.installed || detection.configPaths.length === 0) {
      return {
        clientId,
        success: false,
        serversWritten: 0,
        error: `${adapter.displayName} is not installed or has no config file`,
        syncedAt: new Date().toISOString(),
      }
    }

    const syncService = createSyncService()
    return syncService.sync(adapter, detection.configPaths[0]!)
  })

  // ── clients:sync-all ──────────────────────────────────────────────────────
  ipcMain.handle('clients:sync-all', async (): Promise<SyncResult[]> => {
    log.debug('[ipc] clients:sync-all')

    const syncService = createSyncService()
    const results: SyncResult[] = []

    for (const id of ADAPTER_IDS) {
      const adapter = ADAPTERS.get(id)!
      const detection = await adapter.detect()

      if (!detection.installed || detection.configPaths.length === 0) {
        continue
      }

      const result = await syncService.sync(adapter, detection.configPaths[0]!)
      results.push(result)
    }

    return results
  })

  log.info('[ipc] clients handlers registered')
}
