/**
 * @file src/renderer/components/layout/__tests__/Sidebar.test.tsx
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the Sidebar component. Verifies navigation and
 * active profile rendering behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type React from 'react'
import type { Profile } from '@shared/types'

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
  mockProfilesState.profiles = []
  mockProfilesState.loading = false
  mockProfilesState.load = vi.fn()
})

describe('Sidebar', () => {
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

    it('does not render plan badge in sidebar', () => {
      render(<Sidebar />)
      expect(screen.queryByTestId('plan-badge')).not.toBeInTheDocument()
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
