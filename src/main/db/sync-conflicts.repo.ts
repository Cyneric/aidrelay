/**
 * @file src/main/db/sync-conflicts.repo.ts
 *
 * @created 11.03.2026
 * @modified 11.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Repository for the `sync_conflicts` table, which stores
 * merge conflicts between local and remote versions of registry entities
 * (servers, rules, profiles, install intents).
 */

import type Database from 'better-sqlite3'
import type { SyncConflict } from '@shared/types'

// ─── Row Shape ────────────────────────────────────────────────────────────────

interface SyncConflictRow {
  id: string
  entity_type: string
  entity_id: string
  server_id: string | null
  server_name: string
  field: string
  local_value: string
  remote_value: string
  resolved: number
  created_at: string
  updated_at: string
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

const rowToDomain = (row: SyncConflictRow): SyncConflict => {
  const parseJson = <T>(json: string): T | null => {
    try {
      return JSON.parse(json) as T
    } catch {
      return null
    }
  }

  const conflict = {
    id: row.id,
    serverId: row.server_id ?? '',
    serverName: row.server_name,
    field: row.field,
    localValue: parseJson(row.local_value),
    remoteValue: parseJson(row.remote_value),
    ...(row.resolved === 1 ? { resolved: true } : {}),
  } as SyncConflict
  return conflict
}

const domainToRow = (
  conflict: SyncConflict,
  entityType: string,
  entityId: string,
): SyncConflictRow => ({
  id: conflict.id,
  entity_type: entityType,
  entity_id: entityId,
  server_id: conflict.serverId || null,
  server_name: conflict.serverName,
  field: conflict.field,
  local_value: JSON.stringify(conflict.localValue ?? null),
  remote_value: JSON.stringify(conflict.remoteValue ?? null),
  resolved: conflict.resolved === true ? 1 : 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

// ─── Repository ───────────────────────────────────────────────────────────────

export class SyncConflictsRepo {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  /**
   * Insert a new conflict record.
   */
  insert(conflict: SyncConflict, entityType: string, entityId: string): void {
    const row = domainToRow(conflict, entityType, entityId)
    this.db
      .prepare(
        `INSERT INTO sync_conflicts
         (id, entity_type, entity_id, server_id, server_name, field,
          local_value, remote_value, resolved, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.entity_type,
        row.entity_id,
        row.server_id,
        row.server_name,
        row.field,
        row.local_value,
        row.remote_value,
        row.resolved,
        row.created_at,
        row.updated_at,
      )
  }

  /**
   * Update an existing conflict record.
   */
  update(conflict: SyncConflict, entityType: string, entityId: string): void {
    const row = domainToRow(conflict, entityType, entityId)
    this.db
      .prepare(
        `UPDATE sync_conflicts
         SET server_id = ?,
             server_name = ?,
             field = ?,
             local_value = ?,
             remote_value = ?,
             resolved = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        row.server_id,
        row.server_name,
        row.field,
        row.local_value,
        row.remote_value,
        row.resolved,
        row.updated_at,
        row.id,
      )
  }

  /**
   * Upsert a conflict record.
   */
  upsert(conflict: SyncConflict, entityType: string, entityId: string): void {
    const existing = this.findById(conflict.id)
    if (existing) {
      this.update(conflict, entityType, entityId)
    } else {
      this.insert(conflict, entityType, entityId)
    }
  }

  /**
   * Find a conflict by its ID.
   */
  findById(id: string): SyncConflict | null {
    const row = this.db.prepare(`SELECT * FROM sync_conflicts WHERE id = ?`).get(id) as
      | SyncConflictRow
      | undefined

    return row ? rowToDomain(row) : null
  }

  /**
   * Find a conflict row by its ID, including entity type and entity ID.
   */
  findRowById(id: string): SyncConflictRow | null {
    const row = this.db.prepare(`SELECT * FROM sync_conflicts WHERE id = ?`).get(id) as
      | SyncConflictRow
      | undefined

    return row ?? null
  }

  /**
   * List all unresolved conflicts.
   */
  listUnresolved(): SyncConflict[] {
    const rows = this.db
      .prepare(`SELECT * FROM sync_conflicts WHERE resolved = 0 ORDER BY created_at DESC`)
      .all() as SyncConflictRow[]

    return rows.map(rowToDomain)
  }

  /**
   * List all conflicts (including resolved).
   */
  listAll(): SyncConflict[] {
    const rows = this.db
      .prepare(`SELECT * FROM sync_conflicts ORDER BY resolved ASC, created_at DESC`)
      .all() as SyncConflictRow[]

    return rows.map(rowToDomain)
  }

  /**
   * Mark a conflict as resolved.
   */
  markResolved(id: string): void {
    this.db
      .prepare(`UPDATE sync_conflicts SET resolved = 1, updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id)
  }

  /**
   * Delete a conflict by its ID.
   */
  delete(id: string): void {
    this.db.prepare(`DELETE FROM sync_conflicts WHERE id = ?`).run(id)
  }

  /**
   * Delete all resolved conflicts older than the given date.
   */
  deleteResolvedOlderThan(date: Date): void {
    this.db
      .prepare(`DELETE FROM sync_conflicts WHERE resolved = 1 AND updated_at < ?`)
      .run(date.toISOString())
  }

  /**
   * Delete all conflicts for a specific entity.
   */
  deleteByEntity(entityType: string, entityId: string): void {
    this.db
      .prepare(`DELETE FROM sync_conflicts WHERE entity_type = ? AND entity_id = ?`)
      .run(entityType, entityId)
  }

  /**
   * Clear all conflicts.
   */
  clearAll(): void {
    this.db.prepare(`DELETE FROM sync_conflicts`).run()
  }
}
