/**
 * @file src/main/db/backups.repo.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Repository for config backup history records. Tracks which
 * files were snapshotted, when, and where the backup lives on disk. Used
 * by the sync service to enforce retention limits and enable one-click revert.
 */

import type Database from 'better-sqlite3'
import type { BackupEntry } from '@shared/channels'
import type { ClientId } from '@shared/types'

// ─── Row Shape ────────────────────────────────────────────────────────────────

/**
 * Raw row shape as returned by better-sqlite3 for the `backups` table.
 */
interface BackupRow {
  id: number
  client_id: string
  backup_path: string
  backup_type: string
  created_at: string
  file_size: number
  file_hash: string
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Converts a raw database row into the shared `BackupEntry` type.
 *
 * @param row - The raw SQLite row from the `backups` table.
 * @returns The hydrated `BackupEntry` object.
 */
const rowToEntry = (row: BackupRow): BackupEntry => ({
  id: row.id,
  clientId: row.client_id as ClientId,
  backupPath: row.backup_path,
  backupType: row.backup_type as BackupEntry['backupType'],
  createdAt: row.created_at,
  fileSize: row.file_size,
  fileHash: row.file_hash,
})

// ─── Input Type ───────────────────────────────────────────────────────────────

/**
 * Payload for a new backup record. The auto-increment `id` is assigned
 * by the database.
 */
export interface CreateBackupInput {
  readonly clientId: ClientId
  readonly backupPath: string
  readonly backupType: BackupEntry['backupType']
  readonly fileSize: number
  readonly fileHash: string
}

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Provides access to backup history records.
 * Supports creating records, querying per client, and deleting old entries
 * when the retention limit is reached.
 */
export class BackupsRepo {
  constructor(private readonly db: Database.Database) {}

  /**
   * Inserts a new backup record and returns the persisted entry.
   *
   * @param input - Details of the backup that was written to disk.
   * @returns The persisted `BackupEntry`.
   */
  create(input: CreateBackupInput): BackupEntry {
    const createdAt = new Date().toISOString()

    const result = this.db
      .prepare(
        `INSERT INTO backups (client_id, backup_path, backup_type, created_at, file_size, file_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.clientId,
        input.backupPath,
        input.backupType,
        createdAt,
        input.fileSize,
        input.fileHash,
      )

    return {
      id: result.lastInsertRowid as number,
      clientId: input.clientId,
      backupPath: input.backupPath,
      backupType: input.backupType,
      createdAt,
      fileSize: input.fileSize,
      fileHash: input.fileHash,
    }
  }

  /**
   * Returns the most recent backup for a given client, or null if none exist.
   * Used by clients:detect-all to populate syncStatus and lastSyncedAt.
   *
   * @param clientId - The client to look up.
   * @returns The latest `BackupEntry`, or null.
   */
  findLatestByClient(clientId: ClientId): BackupEntry | null {
    const row = this.db
      .prepare('SELECT * FROM backups WHERE client_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(clientId) as BackupRow | undefined
    return row ? rowToEntry(row) : null
  }

  /**
   * Returns all backup records for a given client, newest first.
   *
   * @param clientId - The client whose backups to retrieve.
   * @returns Array of `BackupEntry` records.
   */
  findByClient(clientId: ClientId): BackupEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM backups WHERE client_id = ? ORDER BY created_at DESC')
      .all(clientId) as BackupRow[]
    return rows.map(rowToEntry)
  }

  /**
   * Deletes a specific backup record by its auto-increment ID.
   *
   * @param id - The backup row ID to remove.
   */
  deleteById(id: number): void {
    this.db.prepare('DELETE FROM backups WHERE id = ?').run(id)
  }

  /**
   * Returns the number of backup records for a given client.
   * Used by the sync service to enforce the per-client retention limit.
   *
   * @param clientId - The client to count backups for.
   * @returns The total number of backup records for that client.
   */
  countByClient(clientId: ClientId): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM backups WHERE client_id = ?')
      .get(clientId) as { count: number }
    return row.count
  }
}
