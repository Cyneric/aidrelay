/**
 * @file src/main/tray/tray.service.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Electron system tray integration. Creates a tray icon in the
 * Windows taskbar notification area with a context menu that lists all saved
 * profiles for quick switching, plus controls to show/hide the main window
 * and quit the application.
 *
 * The profile list is refreshed every time the context menu is opened so that
 * newly created profiles appear without restarting the app.
 */

import { Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import log from 'electron-log'
import { getDatabase } from '@main/db/connection'
import { ProfilesRepo } from '@main/db/profiles.repo'

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Manages the system tray icon and its context menu for the lifetime of the
 * application. Creates the tray once and updates the context menu on demand.
 *
 * Usage:
 *   trayService.create(mainWindow)   // called after app is ready
 *   trayService.destroy()            // called on app quit
 */
export class TrayService {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null

  /**
   * Creates the system tray icon and wires up the initial context menu.
   * Clicking the tray icon toggles the main window visibility.
   *
   * @param mainWindow - The main BrowserWindow to show/hide from the tray.
   */
  create(mainWindow: BrowserWindow): void {
    if (this.tray) {
      log.warn('[tray] create() called but tray already exists — skipping')
      return
    }

    this.mainWindow = mainWindow

    // Use a transparent 1×1 fallback when the icon asset is not present (dev).
    // In production electron-builder copies resources/tray-icon.png into the ASAR.
    const iconPath = join(import.meta.dirname, '../../../../resources/tray-icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    const trayIcon = icon.isEmpty() ? nativeImage.createEmpty() : icon

    this.tray = new Tray(trayIcon)
    this.tray.setToolTip('aidrelay — AI Developer Relay')

    // Re-build context menu on every click so profile list is always current
    this.tray.on('click', () => {
      this.refreshMenu()
      this.tray?.popUpContextMenu()
    })

    this.tray.on('right-click', () => {
      this.refreshMenu()
      this.tray?.popUpContextMenu()
    })

    this.refreshMenu()
    log.info('[tray] created')
  }

  /**
   * Destroys the tray icon and releases resources.
   * Safe to call even if the tray was never created.
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
      this.mainWindow = null
      log.info('[tray] destroyed')
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Rebuilds the tray context menu with the current list of profiles and
   * window state. Called on every tray click so the list stays fresh.
   */
  private refreshMenu(): void {
    if (!this.tray) return

    const profiles = this.loadProfiles()
    const win = this.mainWindow
    const isVisible = win?.isVisible() ?? false

    const profileItems: Parameters<typeof Menu.buildFromTemplate>[0] = profiles.length
      ? profiles.map((p) => ({
          label: `${p.isActive ? '● ' : '  '}${p.name}`,
          type: 'normal' as const,
          enabled: !p.isActive,
          click: () => {
            log.info(`[tray] activating profile "${p.name}" via tray`)
            this.activateProfile(p.id)
          },
        }))
      : [{ label: 'No profiles yet', enabled: false }]

    const menu = Menu.buildFromTemplate([
      { label: 'aidrelay', enabled: false },
      { type: 'separator' },
      { label: 'Profiles', enabled: false },
      ...profileItems,
      { type: 'separator' },
      {
        label: isVisible ? 'Hide window' : 'Show window',
        click: () => {
          if (!win) return
          if (win.isVisible()) {
            win.hide()
          } else {
            win.show()
            win.focus()
          }
          this.refreshMenu()
        },
      },
      { type: 'separator' },
      {
        label: 'Quit aidrelay',
        role: 'quit',
      },
    ])

    this.tray.setContextMenu(menu)
  }

  /**
   * Loads all profiles from the database for the context menu.
   * Returns an empty array on any error so the menu still renders.
   */
  private loadProfiles(): Array<{ id: string; name: string; isActive: boolean }> {
    try {
      const db = getDatabase()
      const repo = new ProfilesRepo(db)
      return repo.findAll().map((p) => ({ id: p.id, name: p.name, isActive: p.isActive }))
    } catch (err) {
      log.warn('[tray] failed to load profiles:', err)
      return []
    }
  }

  /**
   * Activates a profile by sending an IPC-style event to the renderer,
   * which triggers the standard profile activation flow including sync.
   *
   * @param profileId - The UUID of the profile to activate.
   */
  private activateProfile(profileId: string): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('profiles:activate-from-tray', profileId)
        win.show()
        win.focus()
        break
      }
    }
  }
}

/** Singleton tray service used across the app lifetime. */
export const trayService = new TrayService()
