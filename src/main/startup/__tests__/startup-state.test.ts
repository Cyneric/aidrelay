import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sentEvents } = vi.hoisted(() => ({
  sentEvents: [] as Array<{ channel: string; payload: unknown }>,
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {
          send: (channel: string, payload: unknown) => {
            sentEvents.push({ channel, payload })
          },
        },
      },
    ],
  },
}))

import {
  getStartupStatus,
  markStartupComplete,
  resetStartupStateForTests,
  setStartupProgress,
} from '../startup-state'

describe('startup state', () => {
  beforeEach(() => {
    sentEvents.length = 0
    resetStartupStateForTests()
  })

  it('keeps progress monotonic when lower values are reported later', () => {
    setStartupProgress(10, 'Starting')
    setStartupProgress(25, 'Registering IPC')
    setStartupProgress(15, 'Loading UI')

    const status = getStartupStatus()
    expect(status.progress).toBe(25)
    expect(status.message).toBe('Loading UI')
  })

  it('emits monotonic startup progress payloads', () => {
    setStartupProgress(10, 'Starting')
    setStartupProgress(25, 'Registering IPC')
    setStartupProgress(15, 'Loading UI')

    const progressEvents = sentEvents
      .filter((event) => event.channel === 'app:startup-progress')
      .map((event) => (event.payload as { progress: number }).progress)

    expect(progressEvents).toEqual([10, 25, 25])
  })

  it('marks startup complete and emits complete event payload', () => {
    markStartupComplete()
    const status = getStartupStatus()

    expect(status.ready).toBe(true)
    expect(status.progress).toBe(100)
    expect(typeof status.completedAt).toBe('number')

    const completeEvent = sentEvents.find((event) => event.channel === 'app:startup-complete')
    expect(completeEvent).toBeDefined()
  })
})
