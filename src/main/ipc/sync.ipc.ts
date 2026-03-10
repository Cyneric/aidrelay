/**
 * @file src/main/ipc/sync.ipc.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
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
import { checkGate } from '@main/licensing/feature-gates'

// ─── Gate Helper ──────────────────────────────────────────────────────────────

/**
 * Throws a user-friendly error when the current license tier does not include
 * cross-device sync. Called at the top of every write/connect handler.
 *
 * @throws {Error} When the `crossDeviceSync` feature gate is disabled.
 */
const requireGitSyncGate = (): void => {
  if (!checkGate('gitSync')) {
    throw new Error('Git sync requires an aidrelay Pro subscription.')
  }
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `sync:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerSyncIpc = (): void => {
  // ── sync:list-pending ───────────────────────────────────────────────────────
  ipcMain.handle('sync:list-pending', async (): Promise<PendingSetup[]> => {
    log.debug('[ipc] sync:list-pending')
    requireGitSyncGate()
    return crossDeviceSyncService.listPending()
  })

  // ── sync:apply-pending ──────────────────────────────────────────────────────
  ipcMain.handle('sync:apply-pending', async (_event, serverId: string): Promise<void> => {
    log.debug(`[ipc] sync:apply-pending ${serverId}`)
    requireGitSyncGate()
    // TODO: Implement pending setup application
    await Promise.resolve()
    throw new Error('Not implemented')
  })

  // ── sync:auto-pull ──────────────────────────────────────────────────────────
  ipcMain.handle('sync:auto-pull', async (): Promise<void> => {
    log.debug('[ipc] sync:auto-pull')
    requireGitSyncGate()

    await crossDeviceSyncService.autoPull()
  })

  // ── sync:resolve-conflict ───────────────────────────────────────────────────
  ipcMain.handle(
    'sync:resolve-conflict',
    async (_event, conflictId: string, resolution: 'local' | 'remote'): Promise<void> => {
      log.debug(`[ipc] sync:resolve-conflict ${conflictId} ${resolution}`)
      requireGitSyncGate()
      // TODO: Implement conflict resolution
      await Promise.resolve()
      throw new Error('Not implemented')
    },
  )

  // ── sync:push-review ────────────────────────────────────────────────────────
  ipcMain.handle('sync:push-review', async (): Promise<SyncConflict[]> => {
    log.debug('[ipc] sync:push-review')
    requireGitSyncGate()
    return crossDeviceSyncService.pushReview()
  })

  log.info('[ipc] sync handlers registered')
}
