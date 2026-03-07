/**
 * @file src/renderer/components/profiles/__tests__/ProfileCard.test.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the ProfileCard component. Verifies rendering,
 * badge visibility, action button callbacks, and disabled states.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileCard } from '../ProfileCard'
import type { Profile } from '@shared/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseProfile: Profile = {
  id: 'p1',
  name: 'Work Mode',
  description: 'Focused coding sessions',
  icon: '💻',
  color: '#6366f1',
  isActive: false,
  serverOverrides: {},
  ruleOverrides: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileCard', () => {
  it('renders profile name and description', () => {
    render(
      <ProfileCard
        profile={baseProfile}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByTestId('profile-name-p1')).toHaveTextContent('Work Mode')
    expect(screen.getByTestId('profile-description-p1')).toHaveTextContent(
      'Focused coding sessions',
    )
  })

  it('shows Active badge when profile is active', () => {
    render(
      <ProfileCard
        profile={{ ...baseProfile, isActive: true }}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByTestId('profile-active-badge-p1')).toBeInTheDocument()
  })

  it('hides Active badge when profile is not active', () => {
    render(
      <ProfileCard
        profile={baseProfile}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('profile-active-badge-p1')).not.toBeInTheDocument()
  })

  it('shows Activate button when profile is not active', () => {
    render(
      <ProfileCard
        profile={baseProfile}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByTestId('profile-activate-p1')).toBeInTheDocument()
  })

  it('hides Activate button when profile is active', () => {
    render(
      <ProfileCard
        profile={{ ...baseProfile, isActive: true }}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('profile-activate-p1')).not.toBeInTheDocument()
  })

  it('calls onActivate with the profile when Activate clicked', async () => {
    const onActivate = vi.fn()
    render(
      <ProfileCard
        profile={baseProfile}
        onActivate={onActivate}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByTestId('profile-activate-p1'))
    expect(onActivate).toHaveBeenCalledWith(baseProfile)
  })

  it('calls onEdit with the profile when Edit clicked', async () => {
    const onEdit = vi.fn()
    render(
      <ProfileCard profile={baseProfile} onActivate={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} />,
    )
    await userEvent.click(screen.getByTestId('profile-edit-p1'))
    expect(onEdit).toHaveBeenCalledWith(baseProfile)
  })

  it('calls onDelete with the profile when Delete clicked', async () => {
    const onDelete = vi.fn()
    render(
      <ProfileCard
        profile={baseProfile}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    )
    await userEvent.click(screen.getByTestId('profile-delete-p1'))
    expect(onDelete).toHaveBeenCalledWith(baseProfile)
  })

  it('disables Delete button when profile is active', () => {
    render(
      <ProfileCard
        profile={{ ...baseProfile, isActive: true }}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByTestId('profile-delete-p1')).toBeDisabled()
  })

  it('shows correct override counts', () => {
    const profile: Profile = {
      ...baseProfile,
      serverOverrides: { s1: { enabled: true }, s2: { enabled: false } },
      ruleOverrides: { r1: { enabled: true } },
    }
    render(
      <ProfileCard profile={profile} onActivate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByTestId('profile-server-overrides-p1')).toHaveTextContent(
      '2 server overrides',
    )
    expect(screen.getByTestId('profile-rule-overrides-p1')).toHaveTextContent('1 rule override')
  })

  it('uses singular "override" when count is 1', () => {
    const profile: Profile = {
      ...baseProfile,
      serverOverrides: { s1: { enabled: true } },
      ruleOverrides: {},
    }
    render(
      <ProfileCard profile={profile} onActivate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByTestId('profile-server-overrides-p1')).toHaveTextContent('1 server override')
  })
})
