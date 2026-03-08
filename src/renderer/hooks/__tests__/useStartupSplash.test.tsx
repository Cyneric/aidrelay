import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AppStartupCompletePayload,
  AppStartupProgressPayload,
  AppStartupStatus,
} from '@shared/channels'
import { useStartupSplash } from '../useStartupSplash'

const Probe = () => {
  const splash = useStartupSplash()
  return (
    <div>
      <span data-testid="visible">{splash.showSplash ? 'yes' : 'no'}</span>
      <span data-testid="progress">{splash.progress}</span>
      <span data-testid="message">{splash.message}</span>
    </div>
  )
}

describe('useStartupSplash', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-08T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const setupApi = (status: AppStartupStatus) => {
    let progressHandler: ((payload: AppStartupProgressPayload) => void) | null = null
    let completeHandler: ((payload: AppStartupCompletePayload) => void) | null = null

    const currentApi = window.api as unknown as Record<string, unknown>

    ;(window as unknown as { api: Record<string, unknown> }).api = {
      ...currentApi,
      appStartupStatus: () => Promise.resolve(status),
      onStartupProgress: (handler: (payload: AppStartupProgressPayload) => void) => {
        progressHandler = handler
        return () => undefined
      },
      onStartupComplete: (handler: (payload: AppStartupCompletePayload) => void) => {
        completeHandler = handler
        return () => undefined
      },
    }

    return {
      emitProgress: (payload: AppStartupProgressPayload) => progressHandler?.(payload),
      emitComplete: (payload: AppStartupCompletePayload) => completeHandler?.(payload),
    }
  }

  it('shows splash initially and reads startup snapshot', async () => {
    setupApi({
      progress: 10,
      message: 'Starting aidrelay...',
      ready: false,
      startedAt: Date.now(),
    })

    render(<Probe />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('visible')).toHaveTextContent('yes')
    expect(screen.getByTestId('progress')).toHaveTextContent('10')
    expect(screen.getByTestId('message')).toHaveTextContent('Starting aidrelay...')
  })

  it('updates progress and message when startup progress events arrive', async () => {
    const api = setupApi({
      progress: 10,
      message: 'Starting aidrelay...',
      ready: false,
      startedAt: Date.now(),
    })

    render(<Probe />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      api.emitProgress({ progress: 60, message: 'Loading interface...' })
    })

    expect(screen.getByTestId('progress')).toHaveTextContent('60')
    expect(screen.getByTestId('message')).toHaveTextContent('Loading interface...')
  })

  it('does not hide splash before 3 seconds when startup completes early', async () => {
    const api = setupApi({
      progress: 90,
      message: 'Starting background services...',
      ready: false,
      startedAt: Date.now(),
    })

    render(<Probe />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      api.emitComplete({ completedAt: Date.now() })
    })
    act(() => {
      vi.advanceTimersByTime(2999)
    })

    expect(screen.getByTestId('visible')).toHaveTextContent('yes')
  })

  it('hides splash after startup ready and 3 seconds elapsed', async () => {
    const api = setupApi({
      progress: 90,
      message: 'Starting background services...',
      ready: false,
      startedAt: Date.now(),
    })

    render(<Probe />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      api.emitComplete({ completedAt: Date.now() })
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByTestId('visible')).toHaveTextContent('no')
  })
})
