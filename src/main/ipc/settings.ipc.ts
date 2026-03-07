/**
 * @file src/main/ipc/settings.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for the `settings:*` channel namespace. Wires the
 * renderer to the `SettingsRepo` key-value store so the Settings page can
 * persist user preferences (language, Git remote, etc.) without needing
 * its own storage layer.
 *
 * All values are JSON-serializable and stored in the `settings` SQLite table.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import { getDatabase } from '@main/db/connection'
import { SettingsRepo } from '@main/db/settings.repo'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `settings:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerSettingsIpc = (): void => {
  // ── settings:get ─────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_event, key: string): unknown => {
    log.debug(`[ipc] settings:get "${key}"`)
    const repo = new SettingsRepo(getDatabase())
    return repo.get(key) ?? null
  })

  // ── settings:set ─────────────────────────────────────────────────────────
  ipcMain.handle('settings:set', (_event, key: string, value: unknown): void => {
    log.debug(`[ipc] settings:set "${key}"`)
    const repo = new SettingsRepo(getDatabase())
    repo.set(key, value)
  })

  // ── settings:delete ───────────────────────────────────────────────────────
  ipcMain.handle('settings:delete', (_event, key: string): void => {
    log.debug(`[ipc] settings:delete "${key}"`)
    const repo = new SettingsRepo(getDatabase())
    repo.delete(key)
  })

  log.info('[ipc] settings handlers registered')
}
