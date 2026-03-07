/**
 * @file src/main/db/__tests__/helpers.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Test helpers for the database layer. `createTestDb()` spins up
 * an in-memory SQLite database seeded with the full migration SQL so each test
 * suite gets a clean, isolated database without touching the filesystem or
 * needing any Electron APIs.
 */

import Database from 'better-sqlite3'
import { MIGRATION_001 } from '../migrations/index'

/**
 * Creates a fresh in-memory SQLite database with the full schema applied.
 * Foreign key constraints are enabled to mirror the production configuration.
 *
 * Call this in `beforeEach` (or once in `beforeAll` if tests don't modify
 * shared state) and close with `db.close()` in `afterEach`/`afterAll`.
 *
 * @returns A ready-to-use in-memory `better-sqlite3` database instance.
 */
export const createTestDb = (): Database.Database => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(MIGRATION_001)
  return db
}
