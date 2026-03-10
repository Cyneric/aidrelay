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
import type { LicenseStatus, Profile } from '@shared/types'

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
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'nav.servers') return 'MCP Servers'
      if (key === 'nav.sectionCore') return 'Core'
      if (key === 'nav.sectionOperations') return 'Operations'
      if (key === 'nav.sectionSettings') return 'Settings'
      if (key === 'profilesIndicator.label') return 'Active profile'
      if (key === 'profilesIndicator.loading') return 'Loading profile...'
      if (key === 'profilesIndicator.none') return 'No active profile'
      if (key === 'profilesIndicator.aria') return 'Active profile: {{name}}'
      if (key === 'profiles.active') return 'Active'
      return key
    },
  }),
}))

// ─── Theme Hook Mock ──────────────────────────────────────────────────────────

let mockEffectiveTheme: 'light' | 'dark' = 'light'

vi.mock('@/lib/useTheme', () => ({
  useTheme: () => ({
    theme: mockEffectiveTheme,
    setTheme: vi.fn(),
    effectiveTheme: mockEffectiveTheme,
  }),
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

// ─── Profiles Store Mock ─────────────────────────────────────────────────────

const baseProfile: Profile = {
  id: 'p1',
  name: 'Work',
  description: '',
  icon: '🧠',
  color: '#22c55e',
  isActive: true,
  serverOverrides: {},
  ruleOverrides: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockProfilesState = {
  profiles: [] as Profile[],
  loading: false,
  error: null as string | null,
  load: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  activate: vi.fn(),
}

vi.mock('@/stores/profiles.store', () => ({
  useProfilesStore: () => mockProfilesState,
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

import { Sidebar } from '../Sidebar'

beforeEach(() => {
  // Reset to free tier before each test
  mockEffectiveTheme = 'light'
  mockLicenseState.status = {
    tier: 'free',
    valid: false,
    lastValidatedAt: new Date().toISOString(),
  }
  mockLicenseState.loading = false
  mockProfilesState.profiles = []
  mockProfilesState.loading = false
  mockProfilesState.load = vi.fn()
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

    it('does not render standalone subtitle text', () => {
      render(<Sidebar />)
      expect(screen.queryByText('AI Developer Relay')).not.toBeInTheDocument()
    })

    it('uses the light sidebar logo in light theme', () => {
      mockEffectiveTheme = 'light'
      render(<Sidebar />)
      const logo = screen.getByTestId('sidebar-logo')
      expect(logo.getAttribute('src')).toContain('aidrelay_logo_with_slogan_for_lightmode')
    })

    it('uses the dark sidebar logo in dark theme', () => {
      mockEffectiveTheme = 'dark'
      render(<Sidebar />)
      const logo = screen.getByTestId('sidebar-logo')
      expect(logo.getAttribute('src')).toContain('aidrelay_logo_with_slogan_for_darkmode')
    })

    it('renders settings nav link', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('nav-link-settings')).toBeInTheDocument()
    })

    it('renders MCP Servers label in navigation', () => {
      render(<Sidebar />)
      expect(screen.getByText('MCP Servers')).toBeInTheDocument()
    })

    it('renders grouped navigation section labels', () => {
      render(<Sidebar />)
      expect(screen.getByText('Core')).toBeInTheDocument()
      expect(screen.getByText('Operations')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  describe('active profile indicator', () => {
    it('renders the active profile name', () => {
      mockProfilesState.profiles = [baseProfile]
      render(<Sidebar />)
      expect(screen.getByText('Active profile')).toBeInTheDocument()
      expect(screen.getByTestId('active-profile-indicator')).toHaveTextContent('Work')
    })

    it('shows loading text when profiles are loading', () => {
      mockProfilesState.loading = true
      render(<Sidebar />)
      expect(screen.getByTestId('active-profile-loading')).toHaveTextContent('Loading profile...')
    })

    it('shows fallback when no active profile is set', () => {
      mockProfilesState.profiles = [{ ...baseProfile, id: 'p2', isActive: false }]
      render(<Sidebar />)
      expect(screen.getByTestId('active-profile-empty')).toHaveTextContent('No active profile')
    })
  })
})
