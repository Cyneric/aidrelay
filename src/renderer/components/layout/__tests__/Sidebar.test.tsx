/**
 * @file src/renderer/components/layout/__tests__/Sidebar.test.tsx
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the Sidebar component. Verifies that the plan
 * tier badge renders correctly for Free and Pro license states, and that
 * navigation links are present.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type React from 'react'
import type { LicenseStatus } from '@shared/types'

// ─── Router Mock ──────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
    'data-testid': testId,
    'aria-current': ariaCurrent,
  }: {
    to: string
    children: React.ReactNode
    className?: string
    'data-testid'?: string
    'aria-current'?: React.AriaAttributes['aria-current']
  }) => (
    <a href={to} className={className} data-testid={testId} aria-current={ariaCurrent}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/' } }),
}))

// ─── i18n Mock ────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// ─── License Hook Mock ────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

import { Sidebar } from '../Sidebar'

beforeEach(() => {
  // Reset to free tier before each test
  mockLicenseState.status = {
    tier: 'free',
    valid: false,
    lastValidatedAt: new Date().toISOString(),
  }
  mockLicenseState.loading = false
})

describe('Sidebar', () => {
  describe('plan badge — Free tier', () => {
    it('renders the plan badge', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('plan-badge')).toBeInTheDocument()
    })

    it('shows "Free" label on free tier', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('plan-badge')).toHaveTextContent('Free')
    })

    it('has correct aria-label for free tier', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('plan-badge')).toHaveAttribute('aria-label', 'Current plan: Free')
    })
  })

  describe('plan badge — Pro tier', () => {
    beforeEach(() => {
      mockLicenseState.status = {
        tier: 'pro',
        valid: true,
        lastValidatedAt: new Date().toISOString(),
      }
    })

    it('shows "Pro" label on pro tier', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('plan-badge')).toHaveTextContent('Pro')
    })

    it('has correct aria-label for pro tier', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('plan-badge')).toHaveAttribute('aria-label', 'Current plan: Pro')
    })
  })

  describe('plan badge — invalid pro license', () => {
    beforeEach(() => {
      // A pro tier entry that is no longer valid should show Free
      mockLicenseState.status = {
        tier: 'pro',
        valid: false,
        lastValidatedAt: new Date().toISOString(),
      }
    })

    it('shows "Free" when pro license is invalid', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('plan-badge')).toHaveTextContent('Free')
    })
  })

  describe('plan badge — loading state', () => {
    beforeEach(() => {
      mockLicenseState.loading = true
    })

    it('hides the badge while loading', () => {
      render(<Sidebar />)
      expect(screen.queryByTestId('plan-badge')).not.toBeInTheDocument()
    })
  })

  describe('navigation', () => {
    it('renders the sidebar element', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })

    it('renders the full logo in the brand area', () => {
      render(<Sidebar />)
      const logo = screen.getByTestId('sidebar-logo')
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('alt', 'aidrelay logo')
    })

    it('renders settings nav link', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('nav-link-settings')).toBeInTheDocument()
    })
  })
})
