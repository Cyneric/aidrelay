/**
 * @file src/renderer/components/layout/__tests__/TitleBar.test.tsx
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the TitleBar component. Verifies that the drag
 * region, app label, and window control buttons render and behave correctly,
 * and that the maximize icon swaps when the maximize state changes.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { WindowMaximizeChangedPayload } from '@shared/channels'
import { TitleBar } from '../TitleBar'

// ─── window.api mock ──────────────────────────────────────────────────────────

const mockWindowMinimize = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
const mockWindowMaximize = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
const mockWindowClose = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
const mockOnMaximizeChanged = vi
  .fn<(handler: (p: WindowMaximizeChangedPayload) => void) => () => void>()
  .mockReturnValue(() => undefined)

vi.stubGlobal('api', {
  windowMinimize: mockWindowMinimize,
  windowMaximize: mockWindowMaximize,
  windowClose: mockWindowClose,
  onMaximizeChanged: mockOnMaximizeChanged,
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnMaximizeChanged.mockReturnValue(() => undefined)
  })

  it('renders the title bar element', () => {
    render(<TitleBar />)
    expect(screen.getByTestId('title-bar')).toBeInTheDocument()
  })

  it('renders the app label', () => {
    render(<TitleBar />)
    expect(screen.getByTestId('title-bar-label')).toHaveTextContent('aidrelay')
  })

  it('renders all three window control buttons', () => {
    render(<TitleBar />)
    expect(screen.getByTestId('title-bar-minimize')).toBeInTheDocument()
    expect(screen.getByTestId('title-bar-maximize')).toBeInTheDocument()
    expect(screen.getByTestId('title-bar-close')).toBeInTheDocument()
  })

  it('calls windowMinimize when the minimize button is clicked', () => {
    render(<TitleBar />)
    fireEvent.click(screen.getByTestId('title-bar-minimize'))
    expect(mockWindowMinimize).toHaveBeenCalledOnce()
  })

  it('calls windowMaximize when the maximize button is clicked', () => {
    render(<TitleBar />)
    fireEvent.click(screen.getByTestId('title-bar-maximize'))
    expect(mockWindowMaximize).toHaveBeenCalledOnce()
  })

  it('calls windowClose when the close button is clicked', () => {
    render(<TitleBar />)
    fireEvent.click(screen.getByTestId('title-bar-close'))
    expect(mockWindowClose).toHaveBeenCalledOnce()
  })

  it('shows maximize aria-label when window is not maximized', () => {
    render(<TitleBar />)
    expect(screen.getByTestId('title-bar-maximize')).toHaveAttribute(
      'aria-label',
      'Maximize window',
    )
  })

  it('registers onMaximizeChanged listener on mount and cleans it up on unmount', () => {
    const cleanup = vi.fn()
    mockOnMaximizeChanged.mockReturnValue(cleanup)

    const { unmount } = render(<TitleBar />)
    expect(mockOnMaximizeChanged).toHaveBeenCalledOnce()

    unmount()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('updates maximize button aria-label when onMaximizeChanged fires with isMaximized true', () => {
    let capturedHandler: ((p: WindowMaximizeChangedPayload) => void) | undefined
    ;(mockOnMaximizeChanged as Mock).mockImplementation(
      (handler: (p: WindowMaximizeChangedPayload) => void) => {
        capturedHandler = handler
        return () => undefined
      },
    )

    render(<TitleBar />)

    expect(screen.getByTestId('title-bar-maximize')).toHaveAttribute(
      'aria-label',
      'Maximize window',
    )

    // Simulate the main process sending the maximize-changed event
    act(() => {
      capturedHandler?.({ isMaximized: true })
    })

    expect(screen.getByTestId('title-bar-maximize')).toHaveAttribute('aria-label', 'Restore window')
  })

  it('restores maximize aria-label when onMaximizeChanged fires with isMaximized false', () => {
    let capturedHandler: ((p: WindowMaximizeChangedPayload) => void) | undefined
    ;(mockOnMaximizeChanged as Mock).mockImplementation(
      (handler: (p: WindowMaximizeChangedPayload) => void) => {
        capturedHandler = handler
        return () => undefined
      },
    )

    render(<TitleBar />)

    // First maximize
    act(() => {
      capturedHandler?.({ isMaximized: true })
    })
    expect(screen.getByTestId('title-bar-maximize')).toHaveAttribute('aria-label', 'Restore window')

    // Then restore
    act(() => {
      capturedHandler?.({ isMaximized: false })
    })
    expect(screen.getByTestId('title-bar-maximize')).toHaveAttribute(
      'aria-label',
      'Maximize window',
    )
  })
})
