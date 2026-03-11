/**
 * @file src/main/reset/__tests__/factory-reset.service.test.ts
 *
 * @description Unit tests for full factory reset behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockDisconnect,
  mockDeleteAllServiceSecrets,
  mockCreateProfile,
  mockSetActive,
  mockExistsSync,
  mockRmSync,
  mockPrepareRun,
  mockGetPath,
} = vi.hoisted(() => ({
  mockDisconnect: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  mockDeleteAllServiceSecrets: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  mockCreateProfile: vi.fn(() => ({ id: 'p-default' })),
  mockSetActive: vi.fn(),
  mockExistsSync: vi.fn(() => true),
  mockRmSync: vi.fn(),
  mockPrepareRun: vi.fn(),
  mockGetPath: vi.fn(() => 'C:\\Users\\test\\AppData\\Roaming\\aidrelay'),
}))

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
  },
}))

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  rmSync: mockRmSync,
}))

vi.mock('@main/git-sync/git-sync.service', () => ({
  gitSyncService: { disconnect: mockDisconnect },
}))

vi.mock('@main/secrets/keytar.service', () => ({
  deleteAllServiceSecrets: mockDeleteAllServiceSecrets,
}))

vi.mock('@main/db/profiles.repo', () => ({
  ProfilesRepo: vi.fn().mockImplementation(() => ({
    create: mockCreateProfile,
    setActive: mockSetActive,
  })),
}))

const preparedSql: string[] = []
const mockDb = {
  prepare: (sql: string) => {
    preparedSql.push(sql)
    return { run: mockPrepareRun }
  },
  transaction: (fn: () => void) => () => fn(),
}

vi.mock('@main/db/connection', () => ({
  getDatabase: vi.fn(() => mockDb),
}))

describe('runFactoryReset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preparedSql.length = 0
    mockExistsSync.mockReturnValue(true)
  })

  it('clears app-owned state and recreates the default active profile', async () => {
    const { runFactoryReset } = await import('../factory-reset.service')
    const result = await runFactoryReset()

    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(mockDeleteAllServiceSecrets).toHaveBeenCalledTimes(1)

    expect(preparedSql).toEqual(
      expect.arrayContaining([
        'DELETE FROM servers',
        'DELETE FROM rules',
        'DELETE FROM profiles',
        'DELETE FROM settings',
        'DELETE FROM activity_log',
        'DELETE FROM backups',
        "DELETE FROM sqlite_sequence WHERE name IN ('activity_log', 'backups')",
      ]),
    )
    expect(mockCreateProfile).toHaveBeenCalledWith({ name: 'default' })
    expect(mockSetActive).toHaveBeenCalledWith('p-default')

    expect(result.databaseReset).toBe(true)
    expect(result.clearedAllSecrets).toBe(true)
    expect(result.disconnectedGitSync).toBe(true)
    expect(result.deletedPaths).toHaveLength(1)
    expect(result.deletedPaths[0]).toContain('backups')
  })

  it('skips backup directory deletion when it does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    const { runFactoryReset } = await import('../factory-reset.service')
    const result = await runFactoryReset()

    expect(mockRmSync).not.toHaveBeenCalled()
    expect(result.deletedPaths).toEqual([])
  })
})
