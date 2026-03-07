/**
 * @file src/main/ipc/license.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for the `license:*` channel namespace. Wires the
 * renderer to the licensing service for activating, deactivating, and querying
 * the current license status. Also serves the active feature gates so the
 * renderer can gate UI elements against the current tier without importing
 * the gate constants directly.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { LicenseStatus } from '@shared/types'
import type { FeatureGates } from '@shared/channels'
import { activateLicense, deactivateLicense, getStatus } from '@main/licensing/licensing.service'
import { getActiveGates } from '@main/licensing/feature-gates'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `license:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerLicenseIpc = (): void => {
  // ── license:activate ──────────────────────────────────────────────────────
  ipcMain.handle('license:activate', async (_event, key: string): Promise<LicenseStatus> => {
    log.debug('[ipc] license:activate')
    return activateLicense(key)
  })

  // ── license:deactivate ────────────────────────────────────────────────────
  ipcMain.handle('license:deactivate', async (): Promise<void> => {
    log.debug('[ipc] license:deactivate')
    await deactivateLicense()
  })

  // ── license:status ────────────────────────────────────────────────────────
  ipcMain.handle('license:status', (): LicenseStatus => {
    log.debug('[ipc] license:status')
    return getStatus()
  })

  // ── license:feature-gates ─────────────────────────────────────────────────
  ipcMain.handle('license:feature-gates', (): FeatureGates => {
    log.debug('[ipc] license:feature-gates')
    return getActiveGates()
  })

  log.info('[ipc] license handlers registered')
}
