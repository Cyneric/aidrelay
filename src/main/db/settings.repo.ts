/**
 * @file src/main/db/settings.repo.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Thin key-value wrapper over the `settings` table. Stores
 * serializable app preferences (e.g. sync config, last-seen state) as JSON
 * strings so any value shape is supported without a schema change.
 */

import type Database from 'better-sqlite3'

// ─── Row Shape ────────────────────────────────────────────────────────────────

/**
 * Raw row shape for the `settings` table.
 */
interface SettingsRow {
  key: string
  value: string
}

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Provides typed get/set/delete access to the key-value `settings` table.
 * Values are stored as JSON so any serializable type is supported.
 */
export class SettingsRepo {
  constructor(private readonly db: Database.Database) {}

  /**
   * Reads a setting value by key.
   *
   * @param key - The setting key to look up.
   * @returns The deserialized value, or `undefined` if the key does not exist.
   */
  get<T = unknown>(key: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | SettingsRow
      | undefined

    if (!row) return undefined
    return JSON.parse(row.value) as T
  }

  /**
   * Writes a setting value, creating it if it does not exist (upsert semantics).
   *
   * @param key - The setting key to write.
   * @param value - Any JSON-serializable value to store.
   */
  set<T>(key: string, value: T): void {
    this.db
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(key, JSON.stringify(value))
  }

  /**
   * Removes a setting entry by key. No-op if the key does not exist.
   *
   * @param key - The setting key to remove.
   */
  delete(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  }
}
