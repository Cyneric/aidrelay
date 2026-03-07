/**
 * @file src/main/ipc/app.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for app-level queries such as version. Exposes
 * Electron's app API to the renderer for display in the Settings page.
 */

import { ipcMain, app } from 'electron'
import log from 'electron-log'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `app:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerAppIpc = (): void => {
  ipcMain.handle('app:version', (): string => {
    log.debug('[ipc] app:version')
    return app.getVersion()
  })

  log.info('[ipc] app handlers registered')
}
