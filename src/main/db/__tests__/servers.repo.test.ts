/**
 * @file src/main/db/__tests__/servers.repo.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for ServersRepo. Each test uses a fresh in-memory
 * database so runs are fully isolated with no filesystem side effects.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import { ServersRepo } from '../servers.repo'
import { createTestDb } from './helpers'

describe('ServersRepo', () => {
  let db: Database.Database
  let repo: ServersRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new ServersRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns an empty array when no servers exist', () => {
      expect(repo.findAll()).toEqual([])
    })

    it('returns all servers ordered by name', () => {
      repo.create({ name: 'zebra', type: 'stdio', command: 'npx', args: [] })
      repo.create({ name: 'alpha', type: 'stdio', command: 'npx', args: [] })

      const servers = repo.findAll()
      expect(servers[0]?.name).toBe('alpha')
      expect(servers[1]?.name).toBe('zebra')
    })
  })

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns null when the server does not exist', () => {
      expect(repo.findById('non-existent-id')).toBeNull()
    })

    it('returns the correct server by id', () => {
      const created = repo.create({ name: 'my-server', type: 'stdio', command: 'npx' })
      const found = repo.findById(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.name).toBe('my-server')
    })
  })

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates a server with required fields only', () => {
      const server = repo.create({ name: 'minimal', type: 'stdio', command: 'node' })

      expect(server.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(server.name).toBe('minimal')
      expect(server.type).toBe('stdio')
      expect(server.command).toBe('node')
      expect(server.args).toEqual([])
      expect(server.env).toEqual({})
      expect(server.secretEnvKeys).toEqual([])
      expect(server.enabled).toBe(true)
      expect(server.tags).toEqual([])
      expect(server.notes).toBe('')
      expect(server.createdAt).toBeTruthy()
      expect(server.updatedAt).toBeTruthy()
    })

    it('persists optional fields correctly', () => {
      const server = repo.create({
        name: 'full-server',
        type: 'sse',
        command: 'npx',
        args: ['-y', 'some-pkg'],
        env: { PORT: '8080' },
        secretEnvKeys: ['API_KEY'],
        tags: ['work', 'remote'],
        notes: 'Used for work context',
      })

      expect(server.type).toBe('sse')
      expect(server.args).toEqual(['-y', 'some-pkg'])
      expect(server.env).toEqual({ PORT: '8080' })
      expect(server.secretEnvKeys).toEqual(['API_KEY'])
      expect(server.tags).toEqual(['work', 'remote'])
      expect(server.notes).toBe('Used for work context')
    })

    it('throws on duplicate name (UNIQUE constraint)', () => {
      repo.create({ name: 'duplicate', type: 'stdio', command: 'npx' })
      expect(() => repo.create({ name: 'duplicate', type: 'stdio', command: 'npx' })).toThrow()
    })
  })

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('applies partial updates without touching other fields', () => {
      const original = repo.create({
        name: 'to-update',
        type: 'stdio',
        command: 'npx',
        tags: ['original'],
      })

      const updated = repo.update(original.id, { tags: ['updated'] })

      expect(updated.name).toBe('to-update')
      expect(updated.command).toBe('npx')
      expect(updated.tags).toEqual(['updated'])
    })

    it('throws when the server does not exist', () => {
      expect(() => repo.update('bad-id', { command: 'node' })).toThrow('Server not found: bad-id')
    })

    it('bumps updatedAt on update', async () => {
      const created = repo.create({ name: 'ts-test', type: 'stdio', command: 'node' })
      // Small delay to guarantee a different timestamp
      await new Promise((r) => setTimeout(r, 5))
      const updated = repo.update(created.id, { command: 'python' })

      expect(updated.updatedAt >= created.updatedAt).toBe(true)
    })
  })

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the server from the database', () => {
      const server = repo.create({ name: 'to-delete', type: 'stdio', command: 'npx' })
      repo.delete(server.id)

      expect(repo.findById(server.id)).toBeNull()
    })

    it('is a no-op when the id does not exist', () => {
      expect(() => repo.delete('non-existent')).not.toThrow()
    })
  })
})
