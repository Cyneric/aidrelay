/**
 * @file src/main/db/__tests__/rules.repo.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for RulesRepo. Each test uses a fresh in-memory
 * database so runs are fully isolated with no filesystem side effects.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { RulesRepo } from '../rules.repo'
import { createTestDb } from './helpers'

describe('RulesRepo', () => {
  let db: Database.Database
  let repo: RulesRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new RulesRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns an empty array when no rules exist', () => {
      expect(repo.findAll()).toEqual([])
    })

    it('orders rules by category then name', () => {
      repo.create({ name: 'b-rule', content: '# B', category: 'security' })
      repo.create({ name: 'a-rule', content: '# A', category: 'security' })
      repo.create({ name: 'z-rule', content: '# Z', category: 'code-style' })

      const rules = repo.findAll()
      expect(rules[0]?.category).toBe('code-style')
      expect(rules[1]?.name).toBe('a-rule')
      expect(rules[2]?.name).toBe('b-rule')
    })
  })

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns null when the rule does not exist', () => {
      expect(repo.findById('missing')).toBeNull()
    })

    it('returns the correct rule by id', () => {
      const created = repo.create({ name: 'my-rule', content: '# Rule' })
      const found = repo.findById(created.id)

      expect(found?.id).toBe(created.id)
      expect(found?.name).toBe('my-rule')
    })
  })

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('applies sensible defaults for optional fields', () => {
      const rule = repo.create({ name: 'minimal', content: '# Min' })

      expect(rule.description).toBe('')
      expect(rule.category).toBe('general')
      expect(rule.tags).toEqual([])
      expect(rule.enabled).toBe(true)
      expect(rule.priority).toBe('normal')
      expect(rule.scope).toBe('global')
      expect(rule.projectPath).toBeUndefined()
      expect(rule.fileGlobs).toEqual([])
      expect(rule.alwaysApply).toBe(false)
      expect(rule.tokenEstimate).toBe(0)
    })

    it('persists all supplied optional fields', () => {
      const rule = repo.create({
        name: 'full-rule',
        content: '# Full',
        description: 'Detailed description',
        category: 'testing',
        tags: ['vitest'],
        priority: 'high',
        scope: 'project',
        projectPath: '/my/project',
        fileGlobs: ['**/*.test.ts'],
        alwaysApply: true,
      })

      expect(rule.description).toBe('Detailed description')
      expect(rule.category).toBe('testing')
      expect(rule.tags).toEqual(['vitest'])
      expect(rule.priority).toBe('high')
      expect(rule.scope).toBe('project')
      expect(rule.projectPath).toBe('/my/project')
      expect(rule.fileGlobs).toEqual(['**/*.test.ts'])
      expect(rule.alwaysApply).toBe(true)
    })
  })

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates specific fields without touching others', () => {
      const original = repo.create({ name: 'to-update', content: '# Old', priority: 'low' })
      const updated = repo.update(original.id, { priority: 'critical' })

      expect(updated.name).toBe('to-update')
      expect(updated.content).toBe('# Old')
      expect(updated.priority).toBe('critical')
    })

    it('throws when the rule does not exist', () => {
      expect(() => repo.update('bad-id', { content: '# New' })).toThrow('Rule not found: bad-id')
    })
  })

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the rule', () => {
      const rule = repo.create({ name: 'to-delete', content: '# Bye' })
      repo.delete(rule.id)
      expect(repo.findById(rule.id)).toBeNull()
    })

    it('is a no-op for a non-existent id', () => {
      expect(() => repo.delete('nope')).not.toThrow()
    })
  })
})
