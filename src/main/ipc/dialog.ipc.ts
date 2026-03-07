/**
 * @file src/main/ipc/dialog.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for native system dialogs. Exposes Electron's
 * dialog API to the renderer so users can browse for directories and files
 * without requiring nodeIntegration.
 */

import { ipcMain, dialog } from 'electron'
import log from 'electron-log'
import type { ShowOpenDialogOptions, ShowOpenDialogResult } from '@shared/channels'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `dialog:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerDialogIpc = (): void => {
  ipcMain.handle(
    'dialog:show-open',
    async (_event, options: ShowOpenDialogOptions = {}): Promise<ShowOpenDialogResult> => {
      log.debug('[ipc] dialog:show-open')
      const result = await dialog.showOpenDialog({
        properties: [...(options.properties ?? ['openDirectory'])],
        title: options.title ?? 'Select directory',
      })
      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
      }
    },
  )

  log.info('[ipc] dialog handlers registered')
}
