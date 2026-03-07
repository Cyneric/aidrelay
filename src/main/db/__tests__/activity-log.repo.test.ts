/**
 * @file src/main/db/__tests__/activity-log.repo.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for ActivityLogRepo. Verifies append-only insert
 * behaviour and all supported query filter combinations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { ActivityLogRepo } from '../activity-log.repo'
import { createTestDb } from './helpers'

describe('ActivityLogRepo', () => {
  let db: Database.Database
  let repo: ActivityLogRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new ActivityLogRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  // ─── insert ───────────────────────────────────────────────────────────────

  describe('insert()', () => {
    it('persists an entry and returns it with an auto-assigned id', () => {
      const entry = repo.insert({ action: 'server.created' })

      expect(entry.id).toBeGreaterThan(0)
      expect(entry.action).toBe('server.created')
      expect(entry.timestamp).toBeTruthy()
      expect(entry.details).toEqual({})
      expect(entry.clientId).toBeUndefined()
      expect(entry.serverId).toBeUndefined()
    })

    it('stores optional fields', () => {
      const entry = repo.insert({
        action: 'sync.performed',
        details: { serversWritten: 3 },
        clientId: 'cursor',
        serverId: 'srv-uuid',
      })

      expect(entry.details).toEqual({ serversWritten: 3 })
      expect(entry.clientId).toBe('cursor')
      expect(entry.serverId).toBe('srv-uuid')
    })
  })

  // ─── query ────────────────────────────────────────────────────────────────

  describe('query()', () => {
    beforeEach(() => {
      repo.insert({ action: 'server.created', clientId: 'cursor' })
      repo.insert({ action: 'sync.performed', clientId: 'cursor' })
      repo.insert({ action: 'server.created', clientId: 'vscode' })
    })

    it('returns all entries when no filters are provided', () => {
      expect(repo.query()).toHaveLength(3)
    })

    it('filters by action', () => {
      const results = repo.query({ action: 'server.created' })
      expect(results).toHaveLength(2)
      expect(results.every((e) => e.action === 'server.created')).toBe(true)
    })

    it('filters by clientId', () => {
      const results = repo.query({ clientId: 'cursor' })
      expect(results).toHaveLength(2)
      expect(results.every((e) => e.clientId === 'cursor')).toBe(true)
    })

    it('combines multiple filters', () => {
      const results = repo.query({ action: 'server.created', clientId: 'cursor' })
      expect(results).toHaveLength(1)
    })

    it('limits the result count', () => {
      expect(repo.query({ limit: 2 })).toHaveLength(2)
    })

    it('returns results in descending timestamp order', () => {
      const results = repo.query()
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.timestamp >= results[i + 1]!.timestamp).toBe(true)
      }
    })
  })
})
