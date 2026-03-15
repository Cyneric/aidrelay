/**
 * @file src/main/git-sync/__tests__/git-sync.service.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for GitSyncService. All external dependencies
 * (isomorphic-git, keytar, electron, fs, https) are mocked so tests run
 * fully offline without touching the real filesystem or credential store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { createTestDb } from '@main/db/__tests__/helpers'
import { getDatabase } from '@main/db/connection'
import { storeSecret, getSecret, deleteAllSecrets } from '@main/secrets/keytar.service'
import * as gitMod from 'isomorphic-git'
import * as fsMod from 'fs'
import * as fsPromises from 'fs/promises'
import spawn from 'cross-spawn'

const skillsExportToDirectoryMock = vi.fn<
  (syncDir: string) => Promise<{
    skillsExported: number
    userSkillsExported: number
    projectSkillsExported: number
    skillFilesExported: number
  }>
>()
const skillsImportFromDirectoryMock = vi.fn<
  (syncDir: string) => Promise<{
    skillsImported: number
    userSkillsImported: number
    projectSkillsImported: number
    skillConflicts: number
    skillConflictItems: []
    projectSkillMappings: []
  }>
>()

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/mock/userData') },
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('isomorphic-git', () => ({
  clone: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue('deadbeef'),
  push: vi.fn().mockResolvedValue({ ok: true }),
  fetch: vi.fn().mockResolvedValue(undefined),
  resolveRef: vi.fn().mockResolvedValue('deadbeef'),
  writeRef: vi.fn().mockResolvedValue(undefined),
  checkout: vi.fn().mockResolvedValue(undefined),
  statusMatrix: vi.fn().mockResolvedValue([['servers.json', 0, 2, 0]]),
}))

vi.mock('isomorphic-git/http/node', () => ({ default: {} }))

vi.mock('cross-spawn', () => ({
  default: vi.fn(),
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fsMod>()
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    rmSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>()
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('[]'),
  }
})

vi.mock('@main/db/connection', () => ({ getDatabase: vi.fn() }))

vi.mock('@main/secrets/keytar.service', () => ({
  storeSecret: vi.fn().mockResolvedValue(undefined),
  getSecret: vi.fn().mockResolvedValue(null),
  deleteAllSecrets: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@main/skills/skills.service', () => ({
  skillsService: {
    exportToDirectory: (...args: Parameters<typeof skillsExportToDirectoryMock>) =>
      skillsExportToDirectoryMock(...args),
    importFromDirectory: (...args: Parameters<typeof skillsImportFromDirectoryMock>) =>
      skillsImportFromDirectoryMock(...args),
  },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Re-imports the service module after mocks are established. */
const loadService = async () => {
  const mod = await import('../git-sync.service')
  return mod.gitSyncService
}

const createSpawnChild = (exitCode = 0, stderr = '', stdout = '') => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
  }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()

  queueMicrotask(() => {
    if (stdout.length > 0) child.stdout.emit('data', stdout)
    if (stderr.length > 0) child.stderr.emit('data', stderr)
    child.emit('close', exitCode)
  })

  return child
}

const createSpawnError = (message: string, code?: string) => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
  }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()

  queueMicrotask(() => {
    const error = Object.assign(new Error(message), code ? { code } : {})
    child.emit('error', error)
  })

  return child
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GitSyncService', () => {
  let testDb: ReturnType<typeof createTestDb>

  beforeEach(() => {
    vi.clearAllMocks()
    testDb = createTestDb()
    vi.mocked(getDatabase).mockReturnValue(testDb)
    vi.mocked(spawn).mockImplementation(() => createSpawnChild() as never)
    skillsExportToDirectoryMock.mockResolvedValue({
      skillsExported: 0,
      userSkillsExported: 0,
      projectSkillsExported: 0,
      skillFilesExported: 0,
    })
    skillsImportFromDirectoryMock.mockResolvedValue({
      skillsImported: 0,
      userSkillsImported: 0,
      projectSkillsImported: 0,
      skillConflicts: 0,
      skillConflictItems: [],
      projectSkillMappings: [],
    })
  })

  // ── getStatus ────────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns disconnected when no config is stored', async () => {
      const service = await loadService()
      const status = await service.getStatus()
      expect(status.connected).toBe(false)
      expect(status.config).toBeUndefined()
    })

    it('returns disconnected when config exists but token is missing', async () => {
      const service = await loadService()
      // Write a config to settings but leave token as null (default mock).
      testDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'git-sync:config',
        JSON.stringify({
          provider: 'generic',
          remoteUrl: 'https://example.com/repo.git',
          branch: 'main',
        }),
      )

      vi.mocked(getSecret).mockResolvedValue(null)
      vi.mocked(fsMod.existsSync).mockReturnValue(false)

      const status = await service.getStatus()
      expect(status.connected).toBe(false)
    })

    it('returns connected for SSH remotes when clone exists and token is missing', async () => {
      const service = await loadService()
      testDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'git-sync:config',
        JSON.stringify({
          provider: 'generic',
          remoteUrl: 'ssh://git@github.com/owner/repo.git',
          branch: 'main',
        }),
      )

      vi.mocked(getSecret).mockResolvedValue(null)
      vi.mocked(fsMod.existsSync).mockReturnValue(true)

      const status = await service.getStatus()
      expect(status.connected).toBe(true)
    })

    it('returns connected when config, token, and .git dir all exist', async () => {
      const service = await loadService()
      const config = {
        provider: 'generic' as const,
        remoteUrl: 'https://example.com/repo.git',
        branch: 'main',
      }
      testDb
        .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .run('git-sync:config', JSON.stringify(config))

      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockReturnValue(true)

      const status = await service.getStatus()
      expect(status.connected).toBe(true)
      expect(status.config?.remoteUrl).toBe('https://example.com/repo.git')
    })
  })

  // ── connectManual ────────────────────────────────────────────────────────

  describe('connectManual()', () => {
    it('clones HTTPS repo and persists config + token', async () => {
      const service = await loadService()
      vi.mocked(fsMod.existsSync).mockReturnValue(false)

      const status = await service.connectManual({
        remoteUrl: 'https://gitlab.com/user/aidrelay-sync.git',
        authMethod: 'https-token',
        authToken: 'glpat-secret',
      })

      expect(gitMod.clone).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://gitlab.com/user/aidrelay-sync.git',
          ref: 'main',
        }),
      )
      expect(storeSecret).toHaveBeenCalledWith('git-sync', 'token', 'glpat-secret')

      // Config should be persisted.
      const row = testDb
        .prepare("SELECT value FROM settings WHERE key = 'git-sync:config'")
        .get() as { value: string } | undefined
      expect(row).toBeDefined()
      const stored = JSON.parse(row!.value) as { remoteUrl: string; provider: string }
      expect(stored.remoteUrl).toBe('https://gitlab.com/user/aidrelay-sync.git')
      expect(stored.provider).toBe('generic')

      expect(status.connected).toBe(true)
    })

    it('uses the provided branch when specified', async () => {
      const service = await loadService()
      vi.mocked(fsMod.existsSync).mockReturnValue(false)

      await service.connectManual({
        remoteUrl: 'https://github.com/user/sync.git',
        branch: 'develop',
        authMethod: 'https-token',
        authToken: 'ghp_token',
      })

      expect(gitMod.clone).toHaveBeenCalledWith(expect.objectContaining({ ref: 'develop' }))
    })

    it('cleans up an existing git dir before cloning', async () => {
      const service = await loadService()
      vi.mocked(fsMod.existsSync).mockReturnValue(true)

      await service.connectManual({
        remoteUrl: 'https://github.com/user/sync.git',
        authMethod: 'https-token',
        authToken: 'token',
      })

      expect(fsMod.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('git-sync'),
        expect.objectContaining({ recursive: true }),
      )
    })

    it('propagates clone errors as thrown exceptions', async () => {
      const service = await loadService()
      vi.mocked(fsMod.existsSync).mockReturnValue(false)
      vi.mocked(gitMod.clone).mockRejectedValueOnce(new Error('Authentication failed'))

      await expect(
        service.connectManual({
          remoteUrl: 'https://github.com/x/y.git',
          authMethod: 'https-token',
          authToken: 'bad',
        }),
      ).rejects.toThrow('Authentication failed')
    })

    it('uses git CLI for SSH remotes and does not store a token', async () => {
      const service = await loadService()
      vi.mocked(fsMod.existsSync).mockReturnValue(false)

      const status = await service.connectManual({
        remoteUrl: 'ssh://git@github.com/owner/repo.git',
        authMethod: 'ssh',
      })

      expect(spawn).toHaveBeenCalledWith(
        'git',
        [
          'clone',
          '--depth',
          '1',
          '--branch',
          'main',
          'ssh://git@github.com/owner/repo.git',
          expect.stringContaining('git-sync'),
        ],
        expect.objectContaining({
          shell: false,
          windowsHide: true,
        }),
      )
      expect(storeSecret).not.toHaveBeenCalled()
      expect(deleteAllSecrets).toHaveBeenCalledWith('git-sync')
      expect(status.connected).toBe(true)
    })

    it('rejects HTTPS URL when SSH auth is selected', async () => {
      const service = await loadService()

      await expect(
        service.connectManual({
          remoteUrl: 'https://github.com/owner/repo.git',
          authMethod: 'ssh',
        }),
      ).rejects.toThrow('SSH auth requires an SSH remote URL.')
    })

    it('returns actionable error when git CLI is missing for SSH remotes', async () => {
      const service = await loadService()
      vi.mocked(spawn).mockImplementationOnce(
        () => createSpawnError('spawn git ENOENT', 'ENOENT') as never,
      )

      await expect(
        service.connectManual({
          remoteUrl: 'ssh://git@github.com/owner/repo.git',
          authMethod: 'ssh',
        }),
      ).rejects.toThrow('Git CLI executable was not found')
    })

    it('returns actionable error for unknown SSH host key failures', async () => {
      const service = await loadService()
      vi.mocked(spawn).mockImplementationOnce(
        () => createSpawnChild(128, 'Host key verification failed') as never,
      )

      await expect(
        service.connectManual({
          remoteUrl: 'ssh://git@github.com/owner/repo.git',
          authMethod: 'ssh',
        }),
      ).rejects.toThrow('SSH host key verification failed')
    })

    it('returns actionable error for SSH publickey authentication failures', async () => {
      const service = await loadService()
      vi.mocked(spawn).mockImplementationOnce(
        () =>
          createSpawnChild(
            128,
            'git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.',
          ) as never,
      )

      await expect(
        service.connectManual({
          remoteUrl: 'ssh://git@github.com/owner/repo.git',
          authMethod: 'ssh',
        }),
      ).rejects.toThrow('SSH authentication failed (publickey)')
    })
  })

  // ── testRemote ───────────────────────────────────────────────────────────

  describe('testRemote()', () => {
    it('runs read-only ls-remote for SSH and does not mutate persisted config', async () => {
      const service = await loadService()

      const result = await service.testRemote({
        remoteUrl: 'ssh://git@github.com/owner/repo.git',
        authMethod: 'ssh',
      })

      expect(result).toEqual({ success: true })
      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['ls-remote', 'ssh://git@github.com/owner/repo.git', 'HEAD'],
        expect.objectContaining({
          cwd: '/mock/userData',
          shell: false,
          windowsHide: true,
        }),
      )

      const row = testDb.prepare("SELECT value FROM settings WHERE key = 'git-sync:config'").get()
      expect(row).toBeUndefined()
      expect(storeSecret).not.toHaveBeenCalled()
      expect(deleteAllSecrets).not.toHaveBeenCalled()
      expect(gitMod.clone).not.toHaveBeenCalled()
      expect(fsMod.rmSync).not.toHaveBeenCalled()
    })

    it('returns actionable message when git executable is missing', async () => {
      const service = await loadService()
      vi.mocked(spawn).mockImplementationOnce(
        () => createSpawnError('spawn git ENOENT', 'ENOENT') as never,
      )

      const result = await service.testRemote({
        remoteUrl: 'ssh://git@github.com/owner/repo.git',
        authMethod: 'ssh',
      })

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Git CLI executable was not found/)
    })

    it('returns strict host-key guidance when SSH host key is unknown', async () => {
      const service = await loadService()
      vi.mocked(spawn).mockImplementationOnce(
        () => createSpawnChild(128, 'Host key verification failed') as never,
      )

      const result = await service.testRemote({
        remoteUrl: 'ssh://git@github.com/owner/repo.git',
        authMethod: 'ssh',
      })

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/SSH host key verification failed/)
    })
  })

  // ── connectGitHub ────────────────────────────────────────────────────────

  describe('connectGitHub()', () => {
    it('throws when OAuth App credentials are not configured', async () => {
      // Clear credentials and reload the service so the module-level constants
      // are evaluated without values (simulating a build without .env set).
      vi.stubEnv('VITE_GITHUB_CLIENT_ID', '')
      vi.stubEnv('VITE_GITHUB_CLIENT_SECRET', '')
      vi.resetModules()

      const { gitSyncService: freshService } = await import('../git-sync.service')

      await expect(freshService.connectGitHub()).rejects.toThrow(
        /GitHub OAuth App credentials are not configured/,
      )

      vi.unstubAllEnvs()
    })
  })

  // ── disconnect ───────────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('removes the local clone, token, and stored config', async () => {
      const service = await loadService()
      // Seed a config entry.
      testDb
        .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .run(
          'git-sync:config',
          JSON.stringify({ provider: 'generic', remoteUrl: 'https://x.git', branch: 'main' }),
        )

      vi.mocked(fsMod.existsSync).mockReturnValue(true)

      await service.disconnect()

      expect(fsMod.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('git-sync'),
        expect.objectContaining({ recursive: true }),
      )
      expect(deleteAllSecrets).toHaveBeenCalledWith('git-sync')

      const row = testDb.prepare("SELECT value FROM settings WHERE key = 'git-sync:config'").get()
      expect(row).toBeUndefined()
    })

    it('skips rmSync when the git dir does not exist', async () => {
      const service = await loadService()
      vi.mocked(fsMod.existsSync).mockReturnValue(false)

      await service.disconnect()

      expect(fsMod.rmSync).not.toHaveBeenCalled()
    })
  })

  // ── push ─────────────────────────────────────────────────────────────────

  describe('push()', () => {
    const seedConnected = (db: ReturnType<typeof createTestDb>) => {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'git-sync:config',
        JSON.stringify({ provider: 'generic', remoteUrl: 'https://x.git', branch: 'main' }),
      )
    }
    const seedConnectedSsh = (db: ReturnType<typeof createTestDb>) => {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'git-sync:config',
        JSON.stringify({
          provider: 'generic',
          remoteUrl: 'ssh://git@github.com/owner/repo.git',
          branch: 'main',
        }),
      )
    }

    it('returns an error result when not connected (no config)', async () => {
      const service = await loadService()
      await expect(service.push()).rejects.toThrow('Git sync is not configured')
    })

    it('commits and pushes when there are staged changes', async () => {
      const service = await loadService()
      seedConnected(testDb)
      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockReturnValue(true)
      // statusMatrix returns a changed file.
      vi.mocked(gitMod.statusMatrix).mockResolvedValue([['servers.json', 0, 2, 0]])
      vi.mocked(gitMod.commit).mockResolvedValue('deadbeef')

      const result = await service.push()

      expect(result.success).toBe(true)
      expect(result.commitHash).toBe('deadbeef')
      expect(gitMod.add).toHaveBeenCalled()
      expect(gitMod.commit).toHaveBeenCalled()
      expect(gitMod.push).toHaveBeenCalled()
    })

    it('uses git CLI push for SSH remotes', async () => {
      const service = await loadService()
      seedConnectedSsh(testDb)
      vi.mocked(fsMod.existsSync).mockReturnValue(true)
      vi.mocked(gitMod.statusMatrix).mockResolvedValue([['servers.json', 0, 2, 0]])
      vi.mocked(gitMod.commit).mockResolvedValue('deadbeef')

      const result = await service.push()

      expect(result.success).toBe(true)
      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['push', 'origin', 'main'],
        expect.objectContaining({ shell: false }),
      )
      expect(gitMod.push).not.toHaveBeenCalled()
    })

    it('skips commit/push when there are no changes', async () => {
      const service = await loadService()
      seedConnected(testDb)
      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockReturnValue(true)
      // All files unmodified (head=1, workdir=1, stage=1).
      vi.mocked(gitMod.statusMatrix).mockResolvedValue([['servers.json', 1, 1, 1]])

      const result = await service.push()

      expect(result.success).toBe(true)
      expect(result.commitHash).toBeUndefined()
      expect(gitMod.commit).not.toHaveBeenCalled()
      expect(gitMod.push).not.toHaveBeenCalled()
    })

    it('returns a failure result when the git push throws', async () => {
      const service = await loadService()
      seedConnected(testDb)
      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockReturnValue(true)
      vi.mocked(gitMod.statusMatrix).mockResolvedValue([['servers.json', 0, 2, 0]])
      vi.mocked(gitMod.push).mockRejectedValueOnce(new Error('HTTP 401 Unauthorized'))

      const result = await service.push()

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/401/)
    })

    it('updates lastPushAt in settings after a successful push', async () => {
      const service = await loadService()
      seedConnected(testDb)
      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockReturnValue(true)
      vi.mocked(gitMod.statusMatrix).mockResolvedValue([['servers.json', 0, 2, 0]])

      await service.push()

      const row = testDb
        .prepare("SELECT value FROM settings WHERE key = 'git-sync:config'")
        .get() as { value: string } | undefined
      const stored = JSON.parse(row!.value) as { lastPushAt?: string }
      expect(stored.lastPushAt).toBeDefined()
    })
  })

  // ── pull ──────────────────────────────────────────────────────────────────

  describe('pull()', () => {
    const seedConnected = (db: ReturnType<typeof createTestDb>) => {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'git-sync:config',
        JSON.stringify({ provider: 'generic', remoteUrl: 'https://x.git', branch: 'main' }),
      )
    }
    const seedConnectedSsh = (db: ReturnType<typeof createTestDb>) => {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'git-sync:config',
        JSON.stringify({
          provider: 'generic',
          remoteUrl: 'ssh://git@github.com/owner/repo.git',
          branch: 'main',
        }),
      )
    }

    it('returns an error result when not connected (no config)', async () => {
      const service = await loadService()
      await expect(service.pull()).rejects.toThrow('Git sync is not configured')
    })

    it('runs fetch + resolveRef + writeRef + checkout', async () => {
      const service = await loadService()
      seedConnected(testDb)
      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockReturnValue(true)
      vi.mocked(gitMod.resolveRef).mockResolvedValue('deadbeef')
      vi.mocked(fsPromises.readFile).mockResolvedValue('[]')

      await service.pull()

      expect(gitMod.fetch).toHaveBeenCalled()
      expect(gitMod.resolveRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'refs/remotes/origin/main' }),
      )
      expect(gitMod.writeRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'refs/heads/main', value: 'deadbeef', force: true }),
      )
      expect(gitMod.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'main', force: true }),
      )
    })

    it('uses git CLI fetch + reset for SSH remotes', async () => {
      const service = await loadService()
      seedConnectedSsh(testDb)
      vi.mocked(fsMod.existsSync).mockReturnValue(true)
      vi.mocked(fsPromises.readFile).mockResolvedValue('[]')

      const result = await service.pull()

      expect(result.success).toBe(true)
      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['fetch', 'origin', 'main'],
        expect.objectContaining({ shell: false }),
      )
      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['reset', '--hard', 'origin/main'],
        expect.objectContaining({ shell: false }),
      )
      expect(gitMod.fetch).not.toHaveBeenCalled()
    })

    it('imports pulled entities and returns correct counts', async () => {
      const service = await loadService()
      seedConnected(testDb)
      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockImplementation((path) =>
        String(path).replace(/\\/g, '/').endsWith('/.git'),
      )

      const mockServers = [
        {
          name: 'my-server',
          type: 'stdio',
          command: 'npx',
          args: [],
          env: {},
          secretEnvKeys: [],
          enabled: true,
          clientOverrides: {},
          tags: [],
          notes: '',
          id: 'id1',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ]

      vi.mocked(fsPromises.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockServers)) // servers.json
        .mockResolvedValueOnce('[]') // rules.json
        .mockResolvedValueOnce('[]') // profiles.json

      const result = await service.pull()

      expect(result.success).toBe(true)
      expect(result.serversImported).toBe(1)
      expect(result.rulesImported).toBe(0)
      expect(result.profilesImported).toBe(0)
    })

    it('counts conflicts when local entity was modified after the pulled version', async () => {
      const service = await loadService()
      seedConnected(testDb)
      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockImplementation((path) =>
        String(path).replace(/\\/g, '/').endsWith('/.git'),
      )

      // Seed a local server with a newer updatedAt.
      testDb
        .prepare(
          `
        INSERT INTO servers (id, name, type, command, args, env, secret_env_keys, enabled,
          client_overrides, tags, notes, created_at, updated_at)
        VALUES ('local-id', 'my-server', 'stdio', 'npx', '[]', '{}', '[]', 1, '{}', '[]', '', '2026-01-01', '2026-03-01')
      `,
        )
        .run()

      // Pull returns the same server with an older updatedAt → conflict.
      const pulledServers = [
        {
          name: 'my-server',
          type: 'stdio',
          command: 'node',
          args: [],
          env: {},
          secretEnvKeys: [],
          enabled: true,
          clientOverrides: {},
          tags: [],
          notes: '',
          id: 'remote-id',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ]

      vi.mocked(fsPromises.readFile)
        .mockResolvedValueOnce(JSON.stringify(pulledServers))
        .mockResolvedValueOnce('[]')
        .mockResolvedValueOnce('[]')

      const result = await service.pull()

      expect(result.success).toBe(true)
      expect(result.conflicts).toBe(1)
    })

    it('returns a failure result when the fetch throws', async () => {
      const service = await loadService()
      seedConnected(testDb)
      vi.mocked(getSecret).mockResolvedValue('my-token')
      vi.mocked(fsMod.existsSync).mockReturnValue(true)
      vi.mocked(gitMod.fetch).mockRejectedValueOnce(new Error('Network timeout'))

      const result = await service.pull()

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Network timeout/)
    })
  })
})
