/**
 * @file src/main/db/__tests__/connection.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Tests for the migration runner logic. We test it directly using
 * an in-memory database so that `getDatabase()` (which requires Electron's
 * `app.getPath`) is never called. This keeps the test environment clean.
 */

import { describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'

describe('Database migration', () => {
  it('creates all expected tables after migration', () => {
    const db = createTestDb()

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[]

    const tableNames = tables.map((t) => t.name)

    expect(tableNames).toContain('servers')
    expect(tableNames).toContain('activity_log')
    expect(tableNames).toContain('backups')
    expect(tableNames).toContain('rules')
    expect(tableNames).toContain('profiles')
    expect(tableNames).toContain('settings')

    db.close()
  })

  it('creates all expected indexes', () => {
    const db = createTestDb()

    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' ORDER BY name`)
      .all() as { name: string }[]

    const indexNames = indexes.map((i) => i.name)

    expect(indexNames).toContain('idx_activity_log_timestamp')
    expect(indexNames).toContain('idx_activity_log_action')
    expect(indexNames).toContain('idx_backups_client')

    db.close()
  })

  it('enforces the profiles foreign key constraint', () => {
    const db = createTestDb()
    const now = new Date().toISOString()

    expect(() => {
      db.prepare(
        `INSERT INTO profiles
           (id, name, parent_profile_id, server_overrides, rule_overrides, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('child', 'Child', 'non-existent-parent', '{}', '{}', now, now)
    }).toThrow()

    db.close()
  })

  it('allows reading back inserted rows with correct column types', () => {
    const db = createTestDb()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO servers
         (id, name, type, command, args, env, secret_env_keys, enabled,
          client_overrides, tags, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('srv-1', 'test-server', 'stdio', 'npx', '[]', '{}', '[]', 1, '{}', '[]', '', now, now)

    const row = db.prepare('SELECT * FROM servers WHERE id = ?').get('srv-1') as {
      enabled: number
      args: string
    }

    // SQLite stores booleans as integers
    expect(row.enabled).toBe(1)
    // JSON columns come back as strings
    expect(typeof row.args).toBe('string')

    db.close()
  })

  it('seeds a built-in default profile as active', () => {
    const db = createTestDb()

    const row = db.prepare(`SELECT name, is_active FROM profiles WHERE name = 'default'`).get() as
      | { name: string; is_active: number }
      | undefined

    expect(row).toBeDefined()
    expect(row?.name).toBe('default')
    expect(row?.is_active).toBe(1)

    db.close()
  })
})
