/**
 * @file src/main/index.ts
 *
 * @created 07.03.2026
 * @modified 10.03.2026
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
import { fileWatcherService } from './sync/file-watcher.service'
import { trayService } from './tray/tray.service'
import { initUpdater } from './updater/updater.service'
import { markStartupComplete, setStartupError, setStartupProgress } from './startup/startup-state'
import { crossDeviceSyncService } from '@main/sync/cross-device-sync.service'

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

const waitForRendererReady = (win: BrowserWindow): Promise<void> =>
  new Promise((resolve) => {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) {
      resolve()
      return
    }

    if (!win.webContents.isLoadingMainFrame()) {
      resolve()
      return
    }

    win.webContents.once('did-finish-load', () => {
      resolve()
    })
  })

const runStartup = async (): Promise<void> => {
  log.info('aidrelay starting up')
  setStartupProgress(10, 'Starting aidrelay...')

  setStartupProgress(25, 'Registering IPC handlers...')
  registerIpcHandlers()

  setStartupProgress(45, 'Creating main window...')
  const win = createWindow()

  setStartupProgress(60, 'Loading interface...')
  await waitForRendererReady(win)
  setStartupProgress(60, 'Loading interface...')

  setStartupProgress(75, 'Initializing tray...')
  trayService.create(win)

  setStartupProgress(90, 'Starting background services...')
  await fileWatcherService.start()
  initUpdater()

  setStartupProgress(95, 'Checking for remote updates...')
  try {
    await crossDeviceSyncService.autoPull()
  } catch (err) {
    log.error('[startup] auto-pull failed:', err)
  }

  setStartupProgress(100, 'Ready.')
  markStartupComplete()

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}

void app.whenReady().then(() => {
  void runStartup().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown startup error'
    log.error('[startup] failed:', err)
    setStartupError(`Startup failed: ${message}`)
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
