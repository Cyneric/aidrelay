/**
 * @file src/main/ipc/sync.ipc.ts
 *
 * @created 10.03.2026
 * @modified 11.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for assisted cross-device sync operations:
 * auto-pull on startup, pending setup detection, conflict resolution, push review.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { PendingSetup, SyncConflict } from '@shared/types'
import { crossDeviceSyncService } from '@main/sync/cross-device-sync.service'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `sync:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerSyncIpc = (): void => {
  // ── sync:list-pending ───────────────────────────────────────────────────────
  ipcMain.handle('sync:list-pending', async (): Promise<PendingSetup[]> => {
    log.debug('[ipc] sync:list-pending')
    return crossDeviceSyncService.listPending()
  })

  // ── sync:list-conflicts ──────────────────────────────────────────────────────
  ipcMain.handle('sync:list-conflicts', async (): Promise<SyncConflict[]> => {
    log.debug('[ipc] sync:list-conflicts')
    return crossDeviceSyncService.listConflicts()
  })

  // ── sync:apply-pending ──────────────────────────────────────────────────────
  ipcMain.handle('sync:apply-pending', async (_event, serverId: string): Promise<void> => {
    log.debug(`[ipc] sync:apply-pending ${serverId}`)
    // TODO: Implement pending setup application
    await Promise.resolve()
    throw new Error('Not implemented')
  })

  // ── sync:auto-pull ──────────────────────────────────────────────────────────
  ipcMain.handle('sync:auto-pull', async (): Promise<void> => {
    log.debug('[ipc] sync:auto-pull')
    await crossDeviceSyncService.autoPull()
  })

  // ── sync:resolve-conflict ───────────────────────────────────────────────────
  ipcMain.handle(
    'sync:resolve-conflict',
    async (_event, conflictId: string, resolution: 'local' | 'remote'): Promise<void> => {
      log.debug(`[ipc] sync:resolve-conflict ${conflictId} ${resolution}`)
      await crossDeviceSyncService.resolveConflict(conflictId, resolution)
    },
  )

  // ── sync:push-review ────────────────────────────────────────────────────────
  ipcMain.handle('sync:push-review', async (): Promise<SyncConflict[]> => {
    log.debug('[ipc] sync:push-review')
    return crossDeviceSyncService.pushReview()
  })

  log.info('[ipc] sync handlers registered')
}
