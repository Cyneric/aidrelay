/**
 * @file src/main/ipc/__tests__/settings.ipc.test.ts
 *
 * @description Unit tests for settings IPC handlers, including the danger-zone
 * reset flow with selectable reset categories.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { registerSettingsIpc } from '../settings.ipc'
import type { SettingsResetResult } from '@shared/channels'

const { handlers, store, mockDisconnect, mockRelaunch, mockExit, mockRunFactoryReset } = vi.hoisted(
  () => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    store: new Map<string, unknown>(),
    mockDisconnect: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    mockRelaunch: vi.fn(),
    mockExit: vi.fn(),
    mockRunFactoryReset: vi.fn<
      () => Promise<{
        disconnectedGitSync: boolean
        clearedAllSecrets: boolean
        databaseReset: boolean
        deletedPaths: string[]
      }>
    >(() =>
      Promise.resolve({
        disconnectedGitSync: true,
        clearedAllSecrets: true,
        databaseReset: true,
        deletedPaths: ['C:\\Users\\test\\AppData\\Roaming\\aidrelay\\backups'],
      }),
    ),
  }),
)

vi.mock('electron', () => ({
  app: {
    relaunch: mockRelaunch,
    exit: mockExit,
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@main/db/connection', () => ({
  getDatabase: vi.fn(() => ({})),
}))

vi.mock('@main/git-sync/git-sync.service', () => ({
  gitSyncService: {
    disconnect: mockDisconnect,
  },
}))

vi.mock('@main/reset/factory-reset.service', () => ({
  runFactoryReset: mockRunFactoryReset,
}))

vi.mock('@main/db/settings.repo', () => ({
  SettingsRepo: vi.fn().mockImplementation(() => ({
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => {
      store.set(key, value)
    },
    delete: (key: string) => {
      store.delete(key)
    },
  })),
}))

const call = <T>(channel: string, ...args: unknown[]): T => {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler for channel: ${channel}`)
  return handler(undefined, ...args) as T
}

describe('settings IPC handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    handlers.clear()
    store.clear()
    mockDisconnect.mockClear()
    mockRelaunch.mockClear()
    mockExit.mockClear()
    mockRunFactoryReset.mockClear()
    registerSettingsIpc()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('supports settings:get, settings:set, and settings:delete', () => {
    call<void>('settings:set', 'theme', 'dark')
    expect(call<unknown>('settings:get', 'theme')).toBe('dark')
    call<void>('settings:delete', 'theme')
    expect(call<unknown>('settings:get', 'theme')).toBeNull()
  })

  it('settings:reset clears only selected settings keys', async () => {
    store.set('theme', 'dark')
    store.set('language', 'de')
    store.set('git-remote', { remoteUrl: 'https://example.com/repo.git', authMethod: 'ssh' })
    store.set('unrelated', { keep: true })

    const result = await call<Promise<SettingsResetResult>>('settings:reset', {
      scope: 'partial',
      uiPreferences: true,
      gitRemoteForm: true,
      gitSyncConnection: false,
    })

    expect(store.has('theme')).toBe(false)
    expect(store.has('language')).toBe(false)
    expect(store.has('git-remote')).toBe(false)
    expect(store.get('unrelated')).toEqual({ keep: true })
    expect(result.resetKeys).toEqual(expect.arrayContaining(['theme', 'language', 'git-remote']))
    expect(result.disconnectedGitSync).toBe(false)
    expect(result.restartTriggered).toBe(false)
    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it('settings:reset disconnects git sync when selected', async () => {
    store.set('theme', 'dark')

    const result = await call<Promise<SettingsResetResult>>('settings:reset', {
      scope: 'partial',
      uiPreferences: false,
      gitRemoteForm: false,
      gitSyncConnection: true,
    })

    expect(store.get('theme')).toBe('dark')
    expect(result.resetKeys).toEqual([])
    expect(result.disconnectedGitSync).toBe(true)
    expect(result.restartTriggered).toBe(false)
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('settings:reset is a safe no-op when nothing is selected', async () => {
    store.set('theme', 'dark')

    const result = await call<Promise<SettingsResetResult>>('settings:reset', {
      scope: 'partial',
      uiPreferences: false,
      gitRemoteForm: false,
      gitSyncConnection: false,
    })

    expect(store.get('theme')).toBe('dark')
    expect(result.resetKeys).toEqual([])
    expect(result.disconnectedGitSync).toBe(false)
    expect(result.restartTriggered).toBe(false)
    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it('settings:reset factory path triggers service and schedules app relaunch', async () => {
    const result = await call<Promise<SettingsResetResult>>('settings:reset', {
      scope: 'factory',
      uiPreferences: false,
      gitRemoteForm: false,
      gitSyncConnection: false,
    })

    expect(mockRunFactoryReset).toHaveBeenCalledTimes(1)
    expect(result.restartTriggered).toBe(true)
    expect(result.databaseReset).toBe(true)
    expect(result.resetKeys).toEqual(['*'])

    expect(mockRelaunch).not.toHaveBeenCalled()
    expect(mockExit).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(mockRelaunch).toHaveBeenCalledTimes(1)
    expect(mockExit).toHaveBeenCalledWith(0)
  })
})
