/**
 * @file src/main/db/__tests__/settings.repo.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for SettingsRepo. Verifies upsert semantics, typed
 * value round-trips, and deletion for the key-value settings table.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { SettingsRepo } from '../settings.repo'
import { createTestDb } from './helpers'

describe('SettingsRepo', () => {
  let db: Database.Database
  let repo: SettingsRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new SettingsRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  // ─── get ──────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns undefined for a missing key', () => {
      expect(repo.get('missing')).toBeUndefined()
    })

    it('returns the stored string value', () => {
      repo.set('theme', 'dark')
      expect(repo.get<string>('theme')).toBe('dark')
    })

    it('round-trips a number', () => {
      repo.set('maxBackups', 50)
      expect(repo.get<number>('maxBackups')).toBe(50)
    })

    it('round-trips a boolean', () => {
      repo.set('autoSync', true)
      expect(repo.get<boolean>('autoSync')).toBe(true)
    })

    it('round-trips an object', () => {
      const obj = { remote: 'https://github.com/example/repo', branch: 'main' }
      repo.set('gitConfig', obj)
      expect(repo.get<typeof obj>('gitConfig')).toEqual(obj)
    })
  })

  // ─── set (upsert) ─────────────────────────────────────────────────────────

  describe('set()', () => {
    it('overwrites an existing key', () => {
      repo.set('theme', 'light')
      repo.set('theme', 'dark')
      expect(repo.get<string>('theme')).toBe('dark')
    })
  })

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the key', () => {
      repo.set('to-remove', 42)
      repo.delete('to-remove')
      expect(repo.get('to-remove')).toBeUndefined()
    })

    it('is a no-op for a missing key', () => {
      expect(() => repo.delete('nope')).not.toThrow()
    })
  })
})
