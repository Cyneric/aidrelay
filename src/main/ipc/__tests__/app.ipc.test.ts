import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppStartupStatus } from '@shared/channels'

const { handlers, startupSnapshotRef } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  startupSnapshotRef: {
    value: {
      progress: 45,
      message: 'Creating main window...',
      ready: false,
      startedAt: 1000,
    } as AppStartupStatus,
  },
}))

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.2.3',
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(channel, fn)
    },
  },
}))

vi.mock('electron-log', () => ({
  default: { debug: vi.fn(), info: vi.fn() },
}))

vi.mock('@main/startup/startup-state', () => ({
  getStartupStatus: () => startupSnapshotRef.value,
}))

import { registerAppIpc } from '../app.ipc'

const call = <T>(channel: string): T => {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler for channel: ${channel}`)
  return handler(undefined) as T
}

describe('app IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    startupSnapshotRef.value = {
      progress: 45,
      message: 'Creating main window...',
      ready: false,
      startedAt: 1000,
    }
    registerAppIpc()
  })

  it('returns app version', () => {
    expect(call<string>('app:version')).toBe('1.2.3')
  })

  it('returns startup snapshot before completion', () => {
    const status = call<AppStartupStatus>('app:startup-status')
    expect(status.progress).toBe(45)
    expect(status.ready).toBe(false)
  })

  it('returns startup snapshot after completion', () => {
    startupSnapshotRef.value = {
      progress: 100,
      message: 'Ready.',
      ready: true,
      startedAt: 1000,
      completedAt: 2500,
    }

    const status = call<AppStartupStatus>('app:startup-status')
    expect(status.progress).toBe(100)
    expect(status.ready).toBe(true)
    expect(status.completedAt).toBe(2500)
  })
})
