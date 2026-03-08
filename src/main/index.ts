/**
 * @file src/main/index.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
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
import { fileWatcherService } from './sync/file-watcher.service'
import { trayService } from './tray/tray.service'
import { initUpdater } from './updater/updater.service'

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
  const appIcon = process.platform === 'win32' ? 'icon.ico' : 'icon-512.png'
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    icon: join(import.meta.dirname, `../../resources/${appIcon}`),
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

  // Notify the renderer whenever the window is maximized or restored so the
  // custom title bar can swap the maximize/restore button icon accordingly.
  win.on('maximize', () => {
    win.webContents.send('window:maximize-changed', { isMaximized: true })
  })
  win.on('unmaximize', () => {
    win.webContents.send('window:maximize-changed', { isMaximized: false })
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
  const win = createWindow()

  // System tray — lets the user quick-switch profiles and hide/show the window
  trayService.create(win)

  // Start watching client config files for external changes after the window
  // is ready so IPC events can be delivered to the renderer.
  void fileWatcherService.start()

  // Auto-updater — checks for updates 10 s after startup (production only)
  initUpdater()

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Keep the app running in the tray even when the window is closed on Windows
  // so the user can still access the tray icon. Quit only on macOS convention.
  if (process.platform === 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  trayService.destroy()
  void fileWatcherService.stop()
  closeDatabase()
})
