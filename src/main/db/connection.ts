/**
 * @file src/main/db/connection.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description SQLite database connection singleton for the main process.
 * Handles WAL mode, foreign key enforcement, and schema migrations. Only one
 * database instance is created per app lifetime — use `getDatabase()` everywhere
 * instead of constructing `Database` directly.
 */

import { join } from 'path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import log from 'electron-log'
import { MIGRATION_001, MIGRATION_002, MIGRATION_003 } from './migrations/index'

/** All migration scripts in order. Index = version - 1. */
const MIGRATIONS: readonly string[] = [MIGRATION_001, MIGRATION_002, MIGRATION_003]

/** Lazily-created singleton instance. */
let instance: Database.Database | null = null

/**
 * Applies any pending migrations to the database.
 *
 * @param db - The open SQLite database to migrate.
 */
const runMigrations = (db: Database.Database): void => {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) ?? 0

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    const sql = MIGRATIONS[i]
    log.info(`[db] Applying migration ${i + 1} of ${MIGRATIONS.length}`)
    db.exec(sql!)
    db.pragma(`user_version = ${i + 1}`)
    log.info(`[db] Migration ${i + 1} applied — schema now at version ${i + 1}`)
  }
}

/**
 * Returns the shared SQLite database instance, creating it on the first call.
 * Opens `{userData}/aidrelay.db`, enables WAL journal mode and foreign key
 * constraints, then runs any pending migrations.
 *
 * @returns The open `better-sqlite3` database instance.
 */
export const getDatabase = (): Database.Database => {
  if (instance) return instance

  const dbPath = join(app.getPath('userData'), 'aidrelay.db')
  log.info(`[db] Opening database at ${dbPath}`)

  instance = new Database(dbPath)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')

  runMigrations(instance)
  log.info('[db] Database ready')

  return instance
}

/**
 * Closes the database connection and clears the singleton reference.
 * Call this during app shutdown (`app.on('will-quit')`) and in test teardown.
 */
export const closeDatabase = (): void => {
  if (instance) {
    instance.close()
    instance = null
    log.info('[db] Database connection closed')
  }
}
