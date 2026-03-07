/**
 * @file src/renderer/hooks/__tests__/useTokenEstimate.test.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the useTokenEstimate hook. Uses fake timers
 * to control debounce timing and mocks the window.api.rulesEstimateTokens
 * IPC bridge.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTokenEstimate } from '../useTokenEstimate'

// ─── Setup ────────────────────────────────────────────────────────────────────

const mockEstimateTokens = vi.fn<(content: string) => Promise<number>>()

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'api', {
    value: { rulesEstimateTokens: mockEstimateTokens },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTokenEstimate', () => {
  it('returns 0 for empty content immediately', () => {
    const { result } = renderHook(() => useTokenEstimate(''))
    expect(result.current).toBe(0)
  })

  it('returns 0 for whitespace-only content immediately', () => {
    const { result } = renderHook(() => useTokenEstimate('   \n  '))
    expect(result.current).toBe(0)
  })

  it('initialises with a local estimate before debounce fires', () => {
    mockEstimateTokens.mockResolvedValue(99)
    // "hello world" = 2 words → ceil(2 * 1.3) = 3
    const { result } = renderHook(() => useTokenEstimate('hello world'))
    expect(result.current).toBe(3)
  })

  it('calls IPC after 300 ms debounce and updates the estimate', async () => {
    mockEstimateTokens.mockResolvedValue(42)
    const { result } = renderHook(() => useTokenEstimate('some content'))

    await act(async () => {
      vi.advanceTimersByTime(300)
      // flush microtasks so the resolved promise updates state
      await Promise.resolve()
    })

    expect(mockEstimateTokens).toHaveBeenCalledWith('some content')
    expect(result.current).toBe(42)
  })

  it('does not call IPC before 300 ms', () => {
    mockEstimateTokens.mockResolvedValue(10)
    renderHook(() => useTokenEstimate('early'))

    act(() => {
      vi.advanceTimersByTime(299)
    })

    expect(mockEstimateTokens).not.toHaveBeenCalled()
  })

  it('falls back to local estimate when IPC rejects', async () => {
    mockEstimateTokens.mockRejectedValue(new Error('IPC error'))
    // "one two three four five" = 5 words → ceil(5 * 1.3) = 7
    const { result } = renderHook(() => useTokenEstimate('one two three four five'))

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(result.current).toBe(7)
  })

  it('debounces rapid content changes — only fires IPC once', async () => {
    mockEstimateTokens.mockResolvedValue(5)
    const { rerender } = renderHook(({ text }) => useTokenEstimate(text), {
      initialProps: { text: 'a' },
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ text: 'ab' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ text: 'abc' })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    // Only the final value should have triggered an IPC call
    expect(mockEstimateTokens).toHaveBeenCalledTimes(1)
    expect(mockEstimateTokens).toHaveBeenCalledWith('abc')
  })

  it('clears to 0 when content becomes empty mid-debounce', async () => {
    mockEstimateTokens.mockResolvedValue(10)
    const { rerender, result } = renderHook(({ text }) => useTokenEstimate(text), {
      initialProps: { text: 'hello world' },
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ text: '' })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(result.current).toBe(0)
    // IPC should not be called for empty content
    expect(mockEstimateTokens).not.toHaveBeenCalled()
  })
})
