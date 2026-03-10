/**
 * @file src/main/db/__tests__/backups.repo.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for BackupsRepo. Covers creation, client-scoped
 * queries, individual deletion, and the count helper used for retention limits.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { BackupsRepo } from '../backups.repo'
import { createTestDb } from './helpers'

const SAMPLE_BACKUP = {
  clientId: 'cursor' as const,
  backupPath: '/backups/cursor/2026-03-07.json',
  backupType: 'sync' as const,
  fileSize: 1024,
  fileHash: 'abc123',
}

describe('BackupsRepo', () => {
  let db: Database.Database
  let repo: BackupsRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new BackupsRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('persists a backup and returns the entry with auto id', () => {
      const entry = repo.create(SAMPLE_BACKUP)

      expect(entry.id).toBeGreaterThan(0)
      expect(entry.clientId).toBe('cursor')
      expect(entry.backupPath).toBe('/backups/cursor/2026-03-07.json')
      expect(entry.backupType).toBe('sync')
      expect(entry.fileSize).toBe(1024)
      expect(entry.fileHash).toBe('abc123')
      expect(entry.createdAt).toBeTruthy()
    })
  })

  // ─── findByClient ─────────────────────────────────────────────────────────

  describe('findByClient()', () => {
    it('returns only backups for the specified client, newest first', () => {
      repo.create(SAMPLE_BACKUP)
      repo.create({ ...SAMPLE_BACKUP, backupPath: '/backups/cursor/2026-03-08.json' })
      repo.create({ ...SAMPLE_BACKUP, clientId: 'vscode', backupPath: '/backups/vscode/a.json' })

      const results = repo.findByClient('cursor')

      expect(results).toHaveLength(2)
      expect(results.every((e) => e.clientId === 'cursor')).toBe(true)
    })

    it('returns an empty array when no backups exist for the client', () => {
      expect(repo.findByClient('vscode')).toEqual([])
    })
  })

  // ─── query ────────────────────────────────────────────────────────────────

  describe('query()', () => {
    it('supports filtering by type and pagination with newest sort', () => {
      repo.create({ ...SAMPLE_BACKUP, backupPath: '/b/1.json', backupType: 'manual' })
      repo.create({ ...SAMPLE_BACKUP, backupPath: '/b/2.json', backupType: 'sync' })
      repo.create({ ...SAMPLE_BACKUP, backupPath: '/b/3.json', backupType: 'sync' })

      const page = repo.query({
        clientId: 'cursor',
        types: ['sync'],
        sort: 'newest',
        limit: 1,
        offset: 0,
      })

      expect(page.total).toBe(2)
      expect(page.items).toHaveLength(1)
      expect(page.items[0]?.backupType).toBe('sync')
    })

    it('supports search and oldest-first sorting', () => {
      repo.create({ ...SAMPLE_BACKUP, backupPath: '/backups/cursor/special-file.json' })
      repo.create({ ...SAMPLE_BACKUP, backupPath: '/backups/cursor/z-last.json' })

      const page = repo.query({
        clientId: 'cursor',
        search: 'special',
        sort: 'oldest',
        limit: 10,
        offset: 0,
      })

      expect(page.total).toBe(1)
      expect(page.items).toHaveLength(1)
      expect(page.items[0]?.backupPath).toContain('special-file')
    })
  })

  // ─── deleteById ───────────────────────────────────────────────────────────

  describe('deleteById()', () => {
    it('removes the backup record', () => {
      const entry = repo.create(SAMPLE_BACKUP)
      repo.deleteById(entry.id)

      expect(repo.findByClient('cursor')).toHaveLength(0)
    })

    it('is a no-op for a non-existent id', () => {
      expect(() => repo.deleteById(9999)).not.toThrow()
    })
  })

  // ─── countByClient ────────────────────────────────────────────────────────

  describe('countByClient()', () => {
    it('returns 0 when no backups exist', () => {
      expect(repo.countByClient('cursor')).toBe(0)
    })

    it('counts only backups for the specified client', () => {
      repo.create(SAMPLE_BACKUP)
      repo.create(SAMPLE_BACKUP)
      repo.create({ ...SAMPLE_BACKUP, clientId: 'vscode', backupPath: '/b/v.json' })

      expect(repo.countByClient('cursor')).toBe(2)
      expect(repo.countByClient('vscode')).toBe(1)
    })
  })
})
