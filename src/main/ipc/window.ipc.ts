/**
 * @file src/main/ipc/window.ipc.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for native window controls (minimize, maximize,
 * close). Called from the custom title bar in the renderer because
 * `titleBarStyle: 'hidden'` removes the OS-native control buttons.
 */

import { ipcMain, BrowserWindow } from 'electron'

/**
 * Registers IPC handlers that drive the three native window control actions:
 * minimize, toggle-maximize, and close. Each handler resolves the sender's
 * window from the event's WebContents so that multiple windows are handled
 * correctly if they ever coexist.
 */
export const registerWindowIpc = (): void => {
  ipcMain.handle('window:minimize', (event): void => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:maximize', (event): void => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.handle('window:close', (event): void => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
