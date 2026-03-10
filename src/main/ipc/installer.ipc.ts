/**
 * @file src/main/ipc/installer.ipc.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for the installer domain. Follows the two‑step
 * prepare/install pattern established by the registry, extended with
 * preflight checks, cancellation, and repair.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { InstallPlan, PreflightReport, DeviceSetupState } from '@shared/types'
import { InstallerService } from '@main/installer/installer.service'

// ─── Service Factory ──────────────────────────────────────────────────────────

const createService = (): InstallerService => new InstallerService()

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `installer:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerInstallerIpc = (): void => {
  const service = createService()

  // ── installer:prepare ─────────────────────────────────────────────────────
  ipcMain.handle('installer:prepare', async (_event, serverId: string): Promise<InstallPlan> => {
    log.debug(`[ipc] installer:prepare server="${serverId}"`)
    return service.prepare(serverId)
  })

  // ── installer:preflight ──────────────────────────────────────────────────
  ipcMain.handle(
    'installer:preflight',
    async (_event, serverId: string): Promise<PreflightReport> => {
      log.debug(`[ipc] installer:preflight server="${serverId}"`)
      return service.preflight(serverId)
    },
  )

  // ── installer:run ────────────────────────────────────────────────────────
  ipcMain.handle('installer:run', async (_event, serverId: string): Promise<void> => {
    log.debug(`[ipc] installer:run server="${serverId}"`)
    return service.run(serverId)
  })

  // ── installer:cancel ─────────────────────────────────────────────────────
  ipcMain.handle('installer:cancel', async (_event, serverId: string): Promise<void> => {
    log.debug(`[ipc] installer:cancel server="${serverId}"`)
    return service.cancel(serverId)
  })

  // ── installer:status ─────────────────────────────────────────────────────
  ipcMain.handle(
    'installer:status',
    async (_event, serverId: string): Promise<DeviceSetupState | null> => {
      log.debug(`[ipc] installer:status server="${serverId}"`)
      return service.status(serverId)
    },
  )

  // ── installer:repair ─────────────────────────────────────────────────────
  ipcMain.handle('installer:repair', async (_event, serverId: string): Promise<InstallPlan> => {
    log.debug(`[ipc] installer:repair server="${serverId}"`)
    return service.repair(serverId)
  })

  log.info('[ipc] installer handlers registered')
}
