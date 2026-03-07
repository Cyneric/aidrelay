/**
 * @file src/main/sync/__tests__/sync.service.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for SyncService. Uses real temp directories and an
 * in-memory SQLite database so the full 8-step sequence is exercised without
 * any mocks. Electron's `app` module is not needed here because BackupService
 * receives the backup directory via the repo rather than calling app.getPath.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SyncService } from '../sync.service'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { BackupsRepo } from '@main/db/backups.repo'
import { createTestDb } from '@main/db/__tests__/helpers'
import type { ClientAdapter } from '@main/clients/types'
import type { BackupService } from '../backup.service'
import type Database from 'better-sqlite3'

// ─── Test helpers ─────────────────────────────────────────────────────────────

const makeTmpDir = (): string => {
  const dir = join(tmpdir(), `sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * A lightweight BackupService substitute that writes backups to a temp dir
 * instead of calling app.getPath('userData') (which requires Electron).
 */
const makeBackupService = (backupDir: string, repo: BackupsRepo) => ({
  createBackup: (clientId: string, configPath: string, backupType = 'sync') => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join(backupDir, `${timestamp}.json`)
    const content = readFileSync(configPath)
    writeFileSync(backupPath, content)
    return repo.create({
      clientId: clientId as 'cursor',
      backupPath,
      backupType: backupType as 'sync',
      fileSize: content.length,
      fileHash: 'test-hash',
    })
  },
  ensurePristineBackup: vi.fn(),
  pruneOldBackups: vi.fn(),
})

/** Minimal adapter stub that uses the `mcpServers` schema key. */
const makeAdapter = (): ClientAdapter =>
  ({
    id: 'cursor' as const,
    displayName: 'Cursor',
    schemaKey: 'mcpServers' as const,
    detect: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
    validate: vi.fn(),
  }) as unknown as ClientAdapter

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SyncService', () => {
  let db: Database.Database
  let tmpDir: string
  let backupDir: string
  let serversRepo: ServersRepo
  let activityLogRepo: ActivityLogRepo
  let backupsRepo: BackupsRepo
  let syncService: SyncService

  beforeEach(() => {
    tmpDir = makeTmpDir()
    backupDir = join(tmpDir, 'backups')
    mkdirSync(backupDir, { recursive: true })

    db = createTestDb()
    serversRepo = new ServersRepo(db)
    activityLogRepo = new ActivityLogRepo(db)
    backupsRepo = new BackupsRepo(db)

    const backupService = makeBackupService(backupDir, backupsRepo)

    syncService = new SyncService(
      serversRepo,
      activityLogRepo,
      backupService as unknown as BackupService,
    )
  })

  afterEach(() => {
    db.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // ─── Happy path ──────────────────────────────────────────────────────────

  it('writes enabled servers to a new config file', async () => {
    serversRepo.create({ name: 'my-server', type: 'stdio', command: 'npx', args: ['-y', 'pkg'] })

    const configPath = join(tmpDir, 'mcp.json')
    const adapter = makeAdapter()

    const result = await syncService.sync(adapter, configPath)

    expect(result.success).toBe(true)
    expect(result.serversWritten).toBe(1)
    expect(existsSync(configPath)).toBe(true)

    const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    const servers = written['mcpServers'] as Record<string, unknown>
    expect(Object.keys(servers)).toContain('my-server')
  })

  it('preserves unmanaged servers already in the config', async () => {
    const configPath = join(tmpDir, 'mcp.json')
    writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { 'unmanaged-server': { command: 'python' } } }),
    )

    serversRepo.create({ name: 'my-server', type: 'stdio', command: 'npx' })

    const result = await syncService.sync(makeAdapter(), configPath)

    expect(result.success).toBe(true)
    const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    const servers = written['mcpServers'] as Record<string, unknown>

    expect(servers['unmanaged-server']).toBeDefined()
    expect(servers['my-server']).toBeDefined()
  })

  it('leaves no .aidrelay.tmp file after a successful sync', async () => {
    const configPath = join(tmpDir, 'mcp.json')
    await syncService.sync(makeAdapter(), configPath)
    expect(existsSync(`${configPath}.aidrelay.tmp`)).toBe(false)
  })

  it('logs a sync.performed entry in the activity log', async () => {
    const configPath = join(tmpDir, 'mcp.json')
    await syncService.sync(makeAdapter(), configPath)

    const log = activityLogRepo.query({ action: 'sync.performed' })
    expect(log).toHaveLength(1)
    expect(log[0]?.clientId).toBe('cursor')
  })

  // ─── Error path ──────────────────────────────────────────────────────────

  it('returns success=false and logs sync.failed when the config is malformed', async () => {
    const configPath = join(tmpDir, 'mcp.json')
    writeFileSync(configPath, '{ not valid json ')

    const result = await syncService.sync(makeAdapter(), configPath)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/parse failed/i)

    const log = activityLogRepo.query({ action: 'sync.failed' })
    expect(log).toHaveLength(1)
  })

  it('does not overwrite disabled servers', async () => {
    const server = serversRepo.create({ name: 'disabled', type: 'stdio', command: 'npx' })
    // Disable the server
    db.prepare('UPDATE servers SET enabled = 0 WHERE id = ?').run(server.id)

    const configPath = join(tmpDir, 'mcp.json')
    const result = await syncService.sync(makeAdapter(), configPath)

    expect(result.success).toBe(true)
    expect(result.serversWritten).toBe(0)

    const written = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    const servers = written['mcpServers'] as Record<string, unknown>
    expect(Object.keys(servers)).not.toContain('disabled')
  })
})
