/**
 * @file src/main/ipc/__tests__/profiles.ipc.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the profiles IPC handlers. Mocks all DB
 * repositories and the sync services so no real SQLite connection is needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Profile } from '@shared/types'
import { registerProfilesIpc } from '../profiles.ipc'

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const mockProfile: Profile = {
  id: 'p1',
  name: 'Dev Profile',
  description: '',
  icon: '',
  color: '#6366f1',
  isActive: false,
  serverOverrides: {},
  ruleOverrides: {},
  createdAt: '2026-03-07T00:00:00.000Z',
  updatedAt: '2026-03-07T00:00:00.000Z',
}

const mockFindAll = vi.fn(() => [mockProfile])
const mockFindById = vi.fn((_id: string) => mockProfile as Profile | null)
const mockCreate = vi.fn(() => mockProfile)
const mockUpdate = vi.fn(() => mockProfile)
const mockDelete = vi.fn()
const mockSetActive = vi.fn()
const mockLogInsert = vi.fn()
const mockServersUpdate = vi.fn()
const mockRulesUpdate = vi.fn()
const mockSyncServiceSync = vi.fn(() =>
  Promise.resolve({
    clientId: 'cursor' as const,
    success: true,
    serversWritten: 0,
    syncedAt: new Date().toISOString(),
  }),
)
const mockRulesSyncServiceSync = vi.fn(() => ({
  clientId: 'cursor' as const,
  success: true,
  serversWritten: 0,
  syncedAt: new Date().toISOString(),
}))

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('@main/db/connection', () => ({ getDatabase: vi.fn(() => ({})) }))

vi.mock('@main/db/profiles.repo', () => ({
  ProfilesRepo: vi.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    setActive: mockSetActive,
  })),
}))

vi.mock('@main/db/servers.repo', () => ({
  ServersRepo: vi.fn().mockImplementation(() => ({ update: mockServersUpdate })),
}))

vi.mock('@main/db/rules.repo', () => ({
  RulesRepo: vi.fn().mockImplementation(() => ({ update: mockRulesUpdate })),
}))

vi.mock('@main/db/activity-log.repo', () => ({
  ActivityLogRepo: vi.fn().mockImplementation(() => ({ insert: mockLogInsert })),
}))

vi.mock('@main/db/backups.repo', () => ({
  BackupsRepo: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@main/sync/backup.service', () => ({
  BackupService: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@main/sync/sync.service', () => ({
  SyncService: vi.fn().mockImplementation(() => ({ sync: mockSyncServiceSync })),
}))

vi.mock('@main/rules/rules-sync.service', () => ({
  RulesSyncService: vi.fn().mockImplementation(() => ({ sync: mockRulesSyncServiceSync })),
}))

vi.mock('@main/clients/registry', () => ({
  ADAPTER_IDS: ['cursor'],
  ADAPTERS: new Map([
    [
      'cursor',
      {
        detect: vi.fn(() =>
          Promise.resolve({ installed: true, configPaths: ['/fake/path'], serverCount: 0 }),
        ),
      },
    ],
  ]),
}))

// ─── Handler Invoker ──────────────────────────────────────────────────────────

// Map of registered handlers (channel → handler fn)
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    },
  },
}))

registerProfilesIpc()

/** Calls a registered handler with a fake event and the given args. */
const call = <T>(channel: string, ...args: unknown[]): T => {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler for channel: ${channel}`)
  return handler({}, ...args) as T
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('profiles:list', () => {
  it('returns all profiles', () => {
    const result = call<Profile[]>('profiles:list')
    expect(result).toEqual([mockProfile])
    expect(mockFindAll).toHaveBeenCalled()
  })
})

describe('profiles:get', () => {
  it('returns a profile by ID', () => {
    const result = call<Profile | null>('profiles:get', 'p1')
    expect(result).toEqual(mockProfile)
    expect(mockFindById).toHaveBeenCalledWith('p1')
  })

  it('returns null for unknown IDs', () => {
    mockFindById.mockReturnValueOnce(null)
    const result = call<Profile | null>('profiles:get', 'missing')
    expect(result).toBeNull()
  })
})

describe('profiles:create', () => {
  it('creates a profile and logs the action', () => {
    const input = { name: 'New Profile' }
    const result = call<Profile>('profiles:create', input)
    expect(result).toEqual(mockProfile)
    expect(mockCreate).toHaveBeenCalledWith(input)
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.created' }),
    )
  })
})

describe('profiles:update', () => {
  it('updates a profile and logs the action', () => {
    const updates = { name: 'Updated Name' }
    const result = call<Profile>('profiles:update', 'p1', updates)
    expect(result).toEqual(mockProfile)
    expect(mockUpdate).toHaveBeenCalledWith('p1', updates)
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.updated' }),
    )
  })

  it('throws when trying to rename the default profile', () => {
    mockFindById.mockReturnValueOnce({ ...mockProfile, name: 'default' })
    expect(() => call('profiles:update', 'p1', { name: 'renamed' })).toThrow(
      'The default profile name cannot be changed',
    )
  })

  it('allows non-name updates for the default profile', () => {
    const defaultProfile = { ...mockProfile, name: 'default' }
    mockFindById.mockReturnValueOnce(defaultProfile)
    mockUpdate.mockReturnValueOnce({ ...defaultProfile, description: 'Updated description' })

    const result = call<Profile>('profiles:update', 'p1', { description: 'Updated description' })
    expect(result.description).toBe('Updated description')
    expect(mockUpdate).toHaveBeenCalledWith('p1', { description: 'Updated description' })
  })
})

describe('profiles:delete', () => {
  beforeEach(() => {
    mockFindById.mockReturnValue({ ...mockProfile, isActive: false })
  })

  it('deletes an inactive profile and logs the action', () => {
    call<void>('profiles:delete', 'p1')
    expect(mockDelete).toHaveBeenCalledWith('p1')
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.deleted' }),
    )
  })

  it('throws when trying to delete the active profile', () => {
    mockFindById.mockReturnValueOnce({ ...mockProfile, isActive: true })
    expect(() => call('profiles:delete', 'p1')).toThrow('Cannot delete the active profile')
  })

  it('throws when trying to delete the default profile', () => {
    mockFindById.mockReturnValueOnce({ ...mockProfile, name: 'default', isActive: false })
    expect(() => call('profiles:delete', 'p1')).toThrow('The default profile cannot be deleted')
  })
})

describe('profiles:activate', () => {
  it('activates a profile and returns sync results', async () => {
    mockFindById.mockReturnValue({
      ...mockProfile,
      serverOverrides: {},
      ruleOverrides: {},
    })

    const results = await call<Promise<unknown[]>>('profiles:activate', 'p1')
    expect(mockSetActive).toHaveBeenCalledWith('p1')
    expect(Array.isArray(results)).toBe(true)
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.activated' }),
    )
  })

  it('throws when profile not found', async () => {
    mockFindById.mockReturnValueOnce(null)
    await expect(call<Promise<unknown>>('profiles:activate', 'missing')).rejects.toThrow(
      'Profile not found',
    )
  })
})
