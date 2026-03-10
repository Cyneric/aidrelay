/**
 * @file src/renderer/components/layout/__tests__/TitleBar.test.tsx
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the TitleBar component. Verifies that the drag
 * region, brand logo, and window control buttons render and behave correctly,
 * and that the maximize icon swaps when the maximize state changes.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { WindowMaximizeChangedPayload } from '@shared/channels'
import type { LicenseStatus } from '@shared/types'
import { TitleBar } from '../TitleBar'

// ─── Theme Hook Mock ──────────────────────────────────────────────────────────

let mockEffectiveTheme: 'light' | 'dark' = 'light'

vi.mock('@/lib/useTheme', () => ({
  useTheme: () => ({
    theme: mockEffectiveTheme,
    setTheme: vi.fn(),
    effectiveTheme: mockEffectiveTheme,
  }),
}))

// ─── License Hook Mock ───────────────────────────────────────────────────────

const mockLicenseState: {
  status: LicenseStatus
  loading: boolean
  activating: boolean
  activate: () => Promise<void>
  deactivate: () => Promise<void>
} = {
  status: { tier: 'free', valid: false, lastValidatedAt: new Date().toISOString() },
  loading: false,
  activating: false,
  activate: vi.fn(),
  deactivate: vi.fn(),
}

vi.mock('@/lib/useLicense', () => ({
  useLicense: () => mockLicenseState,
}))

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
    mockEffectiveTheme = 'light'
    mockLicenseState.status = {
      tier: 'free',
      valid: false,
      lastValidatedAt: new Date().toISOString(),
    }
    mockLicenseState.loading = false
    vi.clearAllMocks()
    mockOnMaximizeChanged.mockReturnValue(() => undefined)
  })

  it('renders the title bar element', () => {
    render(<TitleBar />)
    expect(screen.getByTestId('title-bar')).toBeInTheDocument()
  })

  it('renders the app logo', () => {
    render(<TitleBar />)
    const logo = screen.getByTestId('title-bar-logo')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('alt', 'aidrelay logo')
  })

  describe('plan badge', () => {
    it('renders the badge when loading is false', () => {
      render(<TitleBar />)
      expect(screen.getByTestId('plan-bookmark')).toBeInTheDocument()
      expect(screen.getByTestId('plan-badge')).toBeInTheDocument()
    })

    it('shows Free label and aria-label on free tier', () => {
      render(<TitleBar />)
      expect(screen.getByTestId('plan-badge')).toHaveTextContent('Free')
      expect(screen.getByTestId('plan-badge')).toHaveAttribute('aria-label', 'Current plan: Free')
    })

    it('shows Pro label and aria-label on valid pro tier', () => {
      mockLicenseState.status = {
        tier: 'pro',
        valid: true,
        lastValidatedAt: new Date().toISOString(),
      }
      render(<TitleBar />)
      expect(screen.getByTestId('plan-badge')).toHaveTextContent('Pro')
      expect(screen.getByTestId('plan-badge')).toHaveAttribute('aria-label', 'Current plan: Pro')
    })

    it('shows Free when pro tier is invalid', () => {
      mockLicenseState.status = {
        tier: 'pro',
        valid: false,
        lastValidatedAt: new Date().toISOString(),
      }
      render(<TitleBar />)
      expect(screen.getByTestId('plan-badge')).toHaveTextContent('Free')
    })

    it('hides the badge while license state is loading', () => {
      mockLicenseState.loading = true
      render(<TitleBar />)
      expect(screen.queryByTestId('plan-badge')).not.toBeInTheDocument()
    })
  })

  it('uses the light title logo in light theme', () => {
    mockEffectiveTheme = 'light'
    render(<TitleBar />)
    const logo = screen.getByTestId('title-bar-logo')
    expect(logo.getAttribute('src')).toContain('logo-light')
  })

  it('uses the dark title logo in dark theme', () => {
    mockEffectiveTheme = 'dark'
    render(<TitleBar />)
    const logo = screen.getByTestId('title-bar-logo')
    expect(logo.getAttribute('src')).toContain('logo-dark')
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
