/**
 * @file src/main/ipc/updater.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for the `updater:*` channel namespace. Exposes
 * manual update checks and the quit-and-install action to the renderer so
 * the Settings page can offer a "Check for updates" button and the update
 * notification banner can trigger an install.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import { checkForUpdates, quitAndInstall } from '@main/updater/updater.service'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `updater:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerUpdaterIpc = (): void => {
  // ── updater:check ─────────────────────────────────────────────────────────
  ipcMain.handle('updater:check', (): void => {
    log.debug('[ipc] updater:check')
    checkForUpdates()
  })

  // ── updater:install ───────────────────────────────────────────────────────
  ipcMain.handle('updater:install', (): void => {
    log.debug('[ipc] updater:install')
    quitAndInstall()
  })

  log.info('[ipc] updater handlers registered')
}
