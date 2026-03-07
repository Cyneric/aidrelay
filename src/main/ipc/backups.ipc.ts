/**
 * @file src/main/ipc/backups.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for the `backups:*` channel namespace. Exposes
 * the per-client backup history and one-click restore functionality to the
 * renderer process.
 *
 * Restoring a backup copies the backup file back to the live config path.
 * The operation creates a safety backup of the current live config before
 * overwriting it, so restores are themselves reversible.
 */

import { ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import log from 'electron-log'
import type { BackupEntry } from '@shared/channels'
import type { ClientId } from '@shared/types'
import { getDatabase } from '@main/db/connection'
import { BackupsRepo } from '@main/db/backups.repo'
import { BackupService } from '@main/sync/backup.service'
import { ADAPTERS } from '@main/clients/registry'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `backups:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerBackupsIpc = (): void => {
  // ── backups:list ──────────────────────────────────────────────────────────
  ipcMain.handle('backups:list', (_event, clientId: ClientId): BackupEntry[] => {
    log.debug(`[ipc] backups:list ${clientId}`)
    const repo = new BackupsRepo(getDatabase())
    return repo.findByClient(clientId)
  })

  // ── backups:restore ───────────────────────────────────────────────────────
  ipcMain.handle('backups:restore', async (_event, backupPath: string, clientId: ClientId) => {
    log.info(`[ipc] backups:restore ${clientId} ← ${backupPath}`)

    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }

    const adapter = ADAPTERS.get(clientId)
    if (!adapter) {
      throw new Error(`Unknown client: ${clientId}`)
    }

    const detection = await adapter.detect()
    if (!detection.installed || detection.configPaths.length === 0) {
      throw new Error(`Client ${clientId} is not installed or has no config path`)
    }

    const liveConfigPath = detection.configPaths[0]!

    // Create a safety backup of the current live config before overwriting
    const db = getDatabase()
    const repo = new BackupsRepo(db)
    const service = new BackupService(repo)

    if (existsSync(liveConfigPath)) {
      service.createBackup(clientId, liveConfigPath, 'sync')
      log.info(`[ipc] safety backup created before restore for ${clientId}`)
    }

    // Restore: copy backup file content back to live config
    const content = readFileSync(backupPath)
    writeFileSync(liveConfigPath, content, { encoding: 'utf-8' })

    log.info(`[ipc] restore complete for ${clientId}`)
  })

  log.info('[ipc] backups handlers registered')
}
