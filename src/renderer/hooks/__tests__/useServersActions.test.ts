/**
 * @file src/renderer/hooks/__tests__/useServersActions.test.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @description Unit tests for useServersActions server-test UX behavior.
 */

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@shared/types'

const testMock = vi.fn<
  (id: string) => Promise<{
    success: boolean
    message: string
    details?: string
    hint?: string
  }>
>()
const syncAllClientsMock = vi.fn<() => Promise<{ success: boolean }[]>>()
const importFromClientsMock =
  vi.fn<() => Promise<{ imported: number; skipped: number; errors: readonly string[] }>>()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()
const toastInfoMock = vi.fn()

vi.mock('@/services/servers.service', () => ({
  serversService: {
    test: (id: string) => testMock(id),
    syncAllClients: () => syncAllClientsMock(),
    importFromClients: () => importFromClientsMock(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => {
      toastSuccessMock(...args)
    },
    error: (...args: unknown[]) => {
      toastErrorMock(...args)
    },
    info: (...args: unknown[]) => {
      toastInfoMock(...args)
    },
  },
}))

import { useServersActions } from '../useServersActions'

const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const makeServer = (id = 'srv-1'): McpServer => ({
  id,
  name: 'devtools',
  type: 'stdio',
  command: 'npx',
  args: ['-y', 'chrome-devtools-mcp@latest'],
  env: {},
  secretEnvKeys: [],
  enabled: true,
  clientOverrides: {
    'claude-desktop': { enabled: true },
    'claude-code': { enabled: true },
    cursor: { enabled: true },
    vscode: { enabled: true },
    'vscode-insiders': { enabled: true },
    windsurf: { enabled: true },
    zed: { enabled: true },
    jetbrains: { enabled: true },
    'codex-cli': { enabled: true },
    'codex-gui': { enabled: true },
    opencode: { enabled: true },
    'visual-studio': { enabled: true },
  },
  tags: [],
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('useServersActions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    syncAllClientsMock.mockResolvedValue([])
    importFromClientsMock.mockResolvedValue({ imported: 0, skipped: 0, errors: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('progresses through testing phases while a server test is pending', async () => {
    const deferred = createDeferred<{ success: boolean; message: string }>()
    testMock.mockReturnValue(deferred.promise)

    const { result } = renderHook(() =>
      useServersActions({
        t: ((key: string) => key) as never,
      }),
    )

    let handleTestPromise: Promise<void> | null = null
    act(() => {
      handleTestPromise = result.current.handleTest(makeServer())
    })

    expect(result.current.getTestingPhase('srv-1')).toBe('starting_process')
    expect(result.current.isTestingServer('srv-1')).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })
    expect(result.current.getTestingPhase('srv-1')).toBe('sending_initialize')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(850)
    })
    expect(result.current.getTestingPhase('srv-1')).toBe('waiting_response')

    deferred.resolve({ success: true, message: 'Connected — devtools' })
    await act(async () => {
      await handleTestPromise!
    })

    expect(result.current.getTestingPhase('srv-1')).toBeNull()
    expect(result.current.isTestingServer('srv-1')).toBe(false)
    expect(result.current.getTestStatus('srv-1')).toBe('success')
  })

  it('tracks phases independently for parallel server tests', async () => {
    const deferredA = createDeferred<{ success: boolean; message: string }>()
    const deferredB = createDeferred<{ success: boolean; message: string }>()
    testMock.mockImplementation((id) => (id === 'srv-1' ? deferredA.promise : deferredB.promise))

    const { result } = renderHook(() =>
      useServersActions({
        t: ((key: string) => key) as never,
      }),
    )

    let testAPromise: Promise<void> | null = null
    let testBPromise: Promise<void> | null = null

    act(() => {
      testAPromise = result.current.handleTest(makeServer('srv-1'))
      testBPromise = result.current.handleTest(makeServer('srv-2'))
    })

    expect(result.current.getTestingPhase('srv-1')).toBe('starting_process')
    expect(result.current.getTestingPhase('srv-2')).toBe('starting_process')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })

    expect(result.current.getTestingPhase('srv-1')).toBe('waiting_response')
    expect(result.current.getTestingPhase('srv-2')).toBe('waiting_response')

    deferredA.resolve({ success: true, message: 'Connected A' })
    await act(async () => {
      await testAPromise!
    })

    expect(result.current.getTestingPhase('srv-1')).toBeNull()
    expect(result.current.getTestingPhase('srv-2')).toBe('waiting_response')
    expect(result.current.getTestStatus('srv-1')).toBe('success')

    deferredB.resolve({ success: false, message: 'Failed B' })
    await act(async () => {
      await testBPromise!
    })

    expect(result.current.getTestingPhase('srv-2')).toBeNull()
    expect(result.current.getTestStatus('srv-2')).toBe('failure')
  })

  it('ignores duplicate test clicks while the same server is already testing', async () => {
    const deferred = createDeferred<{ success: boolean; message: string }>()
    testMock.mockReturnValue(deferred.promise)

    const { result } = renderHook(() =>
      useServersActions({
        t: ((key: string) => key) as never,
      }),
    )

    let firstPromise: Promise<void> | null = null
    let secondPromise: Promise<void> | null = null
    act(() => {
      firstPromise = result.current.handleTest(makeServer('srv-1'))
      secondPromise = result.current.handleTest(makeServer('srv-1'))
    })

    expect(testMock).toHaveBeenCalledTimes(1)
    expect(result.current.isTestingServer('srv-1')).toBe(true)

    deferred.resolve({ success: true, message: 'Connected once' })
    await act(async () => {
      await firstPromise!
      await secondPromise!
    })

    expect(result.current.isTestingServer('srv-1')).toBe(false)
  })

  it('shows error toast with summary title and details/hint description', async () => {
    testMock.mockResolvedValue({
      success: false,
      message: 'No initialize response after 30s.',
      details: 'chrome-devtools-mcp exposes content of the browser instance.',
      hint: 'Ensure Chrome is running with remote debugging on the configured --browser-url port.',
    })

    const { result } = renderHook(() =>
      useServersActions({
        t: ((key: string) => key) as never,
      }),
    )

    await act(async () => {
      await result.current.handleTest(makeServer())
    })

    expect(toastErrorMock).toHaveBeenCalledWith('No initialize response after 30s.', {
      description:
        'chrome-devtools-mcp exposes content of the browser instance.\n\nEnsure Chrome is running with remote debugging on the configured --browser-url port.',
    })
  })
})
