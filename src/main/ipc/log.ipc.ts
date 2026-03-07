/**
 * @file src/main/ipc/log.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for activity log queries. The log is append-only
 * on the write side (log entries are inserted by each domain's IPC handler).
 * This file handles the read side — filtered queries used by the log page.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { ActivityLogEntry, LogFilters } from '@shared/channels'
import { getDatabase } from '@main/db/connection'
import { ActivityLogRepo } from '@main/db/activity-log.repo'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers the `log:query` IPC handler.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerLogIpc = (): void => {
  // ── log:query ─────────────────────────────────────────────────────────────
  ipcMain.handle('log:query', (_event, filters: LogFilters): ActivityLogEntry[] => {
    log.debug('[ipc] log:query', filters)
    const db = getDatabase()
    const repo = new ActivityLogRepo(db)
    return repo.query(filters)
  })

  log.info('[ipc] log handlers registered')
}
