/**
 * @file src/main/updater/updater.service.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Wraps `electron-updater` for auto-update functionality via
 * GitHub Releases. On app startup it silently checks for a new version. When
 * an update is available it notifies the renderer so the user can choose when
 * to install and restart.
 *
 * Update flow:
 *   app start → checkForUpdates()
 *     → no update    : silent, nothing happens
 *     → update found : notify renderer with `updater:update-available`
 *     → downloading  : progress events → `updater:download-progress`
 *     → downloaded   : notify renderer with `updater:update-downloaded`
 *   user clicks "Restart to update" → quitAndInstall()
 *
 * In development mode the updater is disabled to avoid false-positive update
 * checks from non-published builds.
 */

import updaterPkg from 'electron-updater'
import { BrowserWindow } from 'electron'
import log from 'electron-log'
import { is } from '@electron-toolkit/utils'

const { autoUpdater } = updaterPkg

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Progress payload forwarded to the renderer during download.
 */
export interface DownloadProgress {
  readonly bytesPerSecond: number
  readonly percent: number
  readonly transferred: number
  readonly total: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Broadcasts an IPC event to all open renderer windows.
 *
 * @param channel - The IPC channel name.
 * @param payload - Optional data to send alongside the event.
 */
const broadcast = (channel: string, payload?: unknown): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Initialises the auto-updater and sets up all event handlers.
 * Call this once from `app.whenReady()` after the main window is created.
 */
export const initUpdater = (): void => {
  // Skip update checks in development to avoid spurious warnings
  if (is.dev) {
    log.info('[updater] development mode — auto-update disabled')
    return
  }

  // Route electron-updater logs through electron-log for consistency
  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // ── Event Handlers ───────────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking for updates…')
  })

  autoUpdater.on('update-available', (info) => {
    log.info(`[updater] update available: v${String(info.version)}`)
    broadcast('updater:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info(`[updater] no update — current version is up to date (v${String(info.version)})`)
    broadcast('updater:update-not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    const payload: DownloadProgress = {
      bytesPerSecond: progress.bytesPerSecond,
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    }
    log.debug(`[updater] download progress: ${progress.percent.toFixed(1)}%`)
    broadcast('updater:download-progress', payload)
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[updater] update downloaded: v${String(info.version)} — ready to install`)
    broadcast('updater:update-downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    log.error('[updater] error:', err)
    broadcast('updater:error', { message: err.message })
  })

  // Kick off the first check shortly after startup
  setTimeout(() => {
    void autoUpdater.checkForUpdates()
  }, 10_000)

  log.info('[updater] initialised — will check in 10 s')
}

/**
 * Triggers a manual check for updates. Returns a promise that resolves when
 * the check completes. The result is broadcast via IPC events — callers
 * should listen to `updater:update-available` or `updater:update-not-available`.
 */
export const checkForUpdates = (): void => {
  if (is.dev) return
  void autoUpdater.checkForUpdates()
}

/**
 * Quits the application and installs the downloaded update.
 * Only valid after an `update-downloaded` event has been received.
 */
export const quitAndInstall = (): void => {
  log.info('[updater] quitting to install update')
  autoUpdater.quitAndInstall()
}
