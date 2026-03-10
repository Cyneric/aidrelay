/**
 * @file src/main/db/sync-install-intent.repo.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Repository for the `sync_install_intent` table, which stores
 * installation intent metadata that is synced across devices. Contains recipe
 * information and normalized launch config (no secret values).
 */

import type Database from 'better-sqlite3'
import type { SyncedInstallIntent } from '@shared/types'

// ─── Row Shape ────────────────────────────────────────────────────────────────

interface SyncInstallIntentRow {
  server_id: string
  recipe_id: string
  recipe_version: string
  install_policy: string
  normalized_launch_config: string
  created_at: string
  updated_at: string
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

const rowToDomain = (row: SyncInstallIntentRow): SyncedInstallIntent => {
  let normalizedLaunchConfig: Record<string, unknown> = {}
  try {
    normalizedLaunchConfig = JSON.parse(row.normalized_launch_config) as Record<string, unknown>
  } catch {
    // ignore malformed JSON, treat as empty object
  }

  return {
    serverId: row.server_id,
    recipeId: row.recipe_id,
    recipeVersion: row.recipe_version,
    installPolicy: row.install_policy as SyncedInstallIntent['installPolicy'],
    normalizedLaunchConfig,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const domainToRow = (intent: SyncedInstallIntent): SyncInstallIntentRow => ({
  server_id: intent.serverId,
  recipe_id: intent.recipeId,
  recipe_version: intent.recipeVersion,
  install_policy: intent.installPolicy,
  normalized_launch_config: JSON.stringify(intent.normalizedLaunchConfig),
  created_at: intent.createdAt,
  updated_at: intent.updatedAt,
})

// ─── Repository ───────────────────────────────────────────────────────────────

export class SyncInstallIntentRepo {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  /**
   * Find install intent for a specific server.
   */
  findByServerId(serverId: string): SyncedInstallIntent | null {
    const row = this.db
      .prepare(`SELECT * FROM sync_install_intent WHERE server_id = ?`)
      .get(serverId) as SyncInstallIntentRow | undefined

    return row ? rowToDomain(row) : null
  }

  /**
   * Insert a new install intent row. Throws if a row for the same server already exists.
   */
  insert(intent: SyncedInstallIntent): void {
    const row = domainToRow(intent)
    this.db
      .prepare(
        `INSERT INTO sync_install_intent
         (server_id, recipe_id, recipe_version, install_policy, normalized_launch_config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.server_id,
        row.recipe_id,
        row.recipe_version,
        row.install_policy,
        row.normalized_launch_config,
        row.created_at,
        row.updated_at,
      )
  }

  /**
   * Update an existing install intent row.
   */
  update(intent: SyncedInstallIntent): void {
    const row = domainToRow(intent)
    this.db
      .prepare(
        `UPDATE sync_install_intent
         SET recipe_id = ?,
             recipe_version = ?,
             install_policy = ?,
             normalized_launch_config = ?,
             updated_at = ?
         WHERE server_id = ?`,
      )
      .run(
        row.recipe_id,
        row.recipe_version,
        row.install_policy,
        row.normalized_launch_config,
        row.updated_at,
        row.server_id,
      )
  }

  /**
   * Upsert an install intent row.
   */
  upsert(intent: SyncedInstallIntent): void {
    const existing = this.findByServerId(intent.serverId)
    if (existing) {
      this.update(intent)
    } else {
      this.insert(intent)
    }
  }

  /**
   * Delete install intent for a specific server.
   */
  delete(serverId: string): void {
    this.db.prepare(`DELETE FROM sync_install_intent WHERE server_id = ?`).run(serverId)
  }

  /**
   * List all install intents.
   */
  listAll(): SyncedInstallIntent[] {
    const rows = this.db
      .prepare(`SELECT * FROM sync_install_intent ORDER BY updated_at DESC`)
      .all() as SyncInstallIntentRow[]

    return rows.map(rowToDomain)
  }
}
