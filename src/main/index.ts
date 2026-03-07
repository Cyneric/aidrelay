/**
 * @file src/main/index.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Electron main process entry point. Creates the application
 * window with strict security settings and loads the React renderer.
 * No nodeIntegration, contextIsolation always enabled.
 */

import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import log from 'electron-log'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/index'
import { closeDatabase } from './db/connection'

log.transports.file.level = 'info'
log.transports.console.level = 'debug'

// Enable CDP remote debugging so the chrome-devtools MCP can connect to
// the renderer process during development. Never enabled in production.
if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

/**
 * Creates the main application window with enforced security policies.
 * Disables nodeIntegration and enables contextIsolation to prevent
 * renderer process from having direct Node.js access.
 *
 * @returns The created BrowserWindow instance.
 */
const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  })

  // Show the window only once the renderer is ready to avoid white flash
  win.on('ready-to-show', () => {
    win.show()
    log.info('Main window displayed')
  })

  // Open external links in the system browser rather than a new Electron window
  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return win
}

void app.whenReady().then(() => {
  log.info('aidrelay starting up')
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS, keep the app in the dock even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})
