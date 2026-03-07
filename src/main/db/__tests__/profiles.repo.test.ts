/**
 * @file src/main/db/__tests__/profiles.repo.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for ProfilesRepo, including the `setActive()`
 * transaction that must keep exactly one profile active at a time.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { ProfilesRepo } from '../profiles.repo'
import { createTestDb } from './helpers'

describe('ProfilesRepo', () => {
  let db: Database.Database
  let repo: ProfilesRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new ProfilesRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a profile with default values', () => {
      const profile = repo.create({ name: 'Work' })

      expect(profile.name).toBe('Work')
      expect(profile.description).toBe('')
      expect(profile.icon).toBe('')
      expect(profile.color).toBe('#6366f1')
      expect(profile.isActive).toBe(false)
      expect(profile.parentProfileId).toBeUndefined()
      expect(profile.serverOverrides).toEqual({})
      expect(profile.ruleOverrides).toEqual({})
    })

    it('persists optional fields', () => {
      const profile = repo.create({
        name: 'Personal',
        description: 'Home setup',
        icon: '🏠',
        color: '#22c55e',
      })

      expect(profile.description).toBe('Home setup')
      expect(profile.icon).toBe('🏠')
      expect(profile.color).toBe('#22c55e')
    })
  })

  // ─── findAll / findById ───────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns profiles ordered by name', () => {
      repo.create({ name: 'Zeta' })
      repo.create({ name: 'Alpha' })

      const profiles = repo.findAll()
      expect(profiles[0]?.name).toBe('Alpha')
      expect(profiles[1]?.name).toBe('Zeta')
    })
  })

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('partially updates a profile', () => {
      const original = repo.create({ name: 'Draft', description: 'Old' })
      const updated = repo.update(original.id, { description: 'New description' })

      expect(updated.name).toBe('Draft')
      expect(updated.description).toBe('New description')
    })

    it('throws for a non-existent profile', () => {
      expect(() => repo.update('missing', { name: 'Oops' })).toThrow('Profile not found: missing')
    })
  })

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the profile', () => {
      const profile = repo.create({ name: 'Temp' })
      repo.delete(profile.id)
      expect(repo.findById(profile.id)).toBeNull()
    })
  })

  // ─── setActive ────────────────────────────────────────────────────────────

  describe('setActive()', () => {
    it('marks only the specified profile as active', () => {
      const p1 = repo.create({ name: 'P1' })
      const p2 = repo.create({ name: 'P2' })
      const p3 = repo.create({ name: 'P3' })

      repo.setActive(p2.id)

      const all = repo.findAll()
      const active = all.filter((p) => p.isActive)

      expect(active).toHaveLength(1)
      expect(active[0]?.id).toBe(p2.id)

      expect(repo.findById(p1.id)?.isActive).toBe(false)
      expect(repo.findById(p3.id)?.isActive).toBe(false)
    })

    it('switches the active profile correctly', () => {
      const p1 = repo.create({ name: 'P1' })
      const p2 = repo.create({ name: 'P2' })

      repo.setActive(p1.id)
      expect(repo.findById(p1.id)?.isActive).toBe(true)

      repo.setActive(p2.id)
      expect(repo.findById(p1.id)?.isActive).toBe(false)
      expect(repo.findById(p2.id)?.isActive).toBe(true)
    })

    it('throws for a non-existent profile', () => {
      expect(() => repo.setActive('nope')).toThrow('Profile not found: nope')
    })
  })
})
