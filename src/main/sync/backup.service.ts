/**
 * @file src/main/sync/backup.service.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Backup service for client config files. Creates timestamped
 * snapshots before every sync and tracks them in the database so they can be
 * listed and restored from the UI. Also ensures a "pristine" backup is always
 * preserved — the user's original config before aidrelay ever touched it.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { createHash } from 'crypto'
import { app } from 'electron'
import log from 'electron-log'
import type { BackupEntry } from '@shared/channels'
import type { ClientId } from '@shared/types'
import type { BackupsRepo } from '@main/db/backups.repo'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the directory where backups for the given client are stored.
 *
 * @param clientId - The client whose backup directory to resolve.
 * @returns Absolute path to the backup directory.
 */
const backupDirForClient = (clientId: ClientId): string =>
  join(app.getPath('userData'), 'backups', clientId)

/**
 * Computes the SHA-256 hash of a file's contents.
 *
 * @param filePath - Path to the file to hash.
 * @returns Hex-encoded SHA-256 digest.
 */
const sha256 = (filePath: string): string =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex')

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Provides backup creation and pristine snapshot management for client configs.
 * Accepts a `BackupsRepo` at construction so services in tests can inject an
 * in-memory database.
 */
export class BackupService {
  constructor(private readonly repo: BackupsRepo) {}

  /**
   * Copies a client config file to the backup directory with a timestamped
   * filename and records the entry in the database.
   *
   * @param clientId - The client whose config is being backed up.
   * @param configPath - Absolute path to the live config file.
   * @param backupType - Whether this is a routine sync backup, a pristine
   *   snapshot, or a manually triggered backup.
   * @returns The persisted `BackupEntry`.
   */
  createBackup(
    clientId: ClientId,
    configPath: string,
    backupType: BackupEntry['backupType'] = 'sync',
  ): BackupEntry {
    const backupDir = backupDirForClient(clientId)
    mkdirSync(backupDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFilename = `${timestamp}.json`
    const backupPath = join(backupDir, backupFilename)

    const content = readFileSync(configPath)
    writeFileSync(backupPath, content)

    const fileSize = content.length
    const fileHash = sha256(configPath)

    log.info(`[backup] created ${backupType} backup for ${clientId}: ${basename(backupPath)}`)

    return this.repo.create({ clientId, backupPath, backupType, fileSize, fileHash })
  }

  /**
   * Ensures a pristine backup exists for the given client config. If one
   * already exists in the database, this is a no-op. Call this the first
   * time aidrelay detects a client config to capture the user's original state.
   *
   * @param clientId - The client to check.
   * @param configPath - Absolute path to the live config file.
   */
  ensurePristineBackup(clientId: ClientId, configPath: string): void {
    if (!existsSync(configPath)) return

    const existing = this.repo.findByClient(clientId)
    const hasPristine = existing.some((b) => b.backupType === 'pristine')

    if (!hasPristine) {
      this.createBackup(clientId, configPath, 'pristine')
      log.info(`[backup] pristine backup created for ${clientId}`)
    }
  }

  /**
   * Lists all backup records for a given client, newest first.
   *
   * @param clientId - The client whose backups to retrieve.
   * @returns Array of `BackupEntry` records.
   */
  listBackups(clientId: ClientId): BackupEntry[] {
    return this.repo.findByClient(clientId)
  }

  /**
   * Deletes the oldest regular sync backups for a client when the count
   * exceeds the retention limit. Pristine backups are never deleted.
   *
   * @param clientId - The client to prune backups for.
   * @param maxSyncBackups - Maximum number of `sync` backups to keep (default 50).
   */
  pruneOldBackups(clientId: ClientId, maxSyncBackups = 50): void {
    const all = this.repo.findByClient(clientId)
    const syncBackups = all.filter((b) => b.backupType === 'sync')

    if (syncBackups.length > maxSyncBackups) {
      // Entries are ordered newest-first; remove from the tail
      const toDelete = syncBackups.slice(maxSyncBackups)
      for (const backup of toDelete) {
        this.repo.deleteById(backup.id)
        log.debug(`[backup] pruned old backup ${backup.id} for ${clientId}`)
      }
    }
  }
}
