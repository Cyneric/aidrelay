/**
 * @file src/renderer/components/profiles/__tests__/ProfileCard.test.tsx
 *
 * @created 07.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the ProfileCard component. Verifies rendering,
 * badge visibility, action button callbacks, and disabled states via the
 * RowActions dropdown pattern.
 */

import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
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
    renderWithProviders(
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
    renderWithProviders(
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
    renderWithProviders(
      <ProfileCard
        profile={baseProfile}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('profile-active-badge-p1')).not.toBeInTheDocument()
  })

  it('shows Activate primary action when profile is not active', () => {
    renderWithProviders(
      <ProfileCard
        profile={baseProfile}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByTestId('profile-actions-p1-primary')).toBeInTheDocument()
  })

  it('hides Activate primary action when profile is active', () => {
    renderWithProviders(
      <ProfileCard
        profile={{ ...baseProfile, isActive: true }}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('profile-actions-p1-primary')).not.toBeInTheDocument()
  })

  it('calls onActivate with the profile when Activate clicked', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    renderWithProviders(
      <ProfileCard
        profile={baseProfile}
        onActivate={onActivate}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await user.click(screen.getByTestId('profile-actions-p1-primary'))
    expect(onActivate).toHaveBeenCalledWith(baseProfile)
  })

  it('calls onEdit with the profile when Edit clicked in dropdown', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    renderWithProviders(
      <ProfileCard profile={baseProfile} onActivate={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} />,
    )
    await user.click(screen.getByTestId('profile-actions-p1-menu-trigger'))
    const editItem = await screen.findByTestId('profile-actions-p1-item-edit')
    await user.click(editItem)
    expect(onEdit).toHaveBeenCalledWith(baseProfile)
  })

  it('calls onDelete with the profile when Delete clicked in dropdown', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    renderWithProviders(
      <ProfileCard
        profile={baseProfile}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    )
    await user.click(screen.getByTestId('profile-actions-p1-menu-trigger'))
    const deleteItem = await screen.findByTestId('profile-actions-p1-item-delete')
    await user.click(deleteItem)
    expect(onDelete).toHaveBeenCalledWith(baseProfile)
  })

  it('disables Delete item when profile is active', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProfileCard
        profile={{ ...baseProfile, isActive: true }}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await user.click(screen.getByTestId('profile-actions-p1-menu-trigger'))
    const deleteItem = await screen.findByTestId('profile-actions-p1-item-delete')
    expect(deleteItem).toHaveAttribute('data-disabled', '')
  })

  it('disables Delete item for the default profile', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProfileCard
        profile={{ ...baseProfile, name: 'default', isActive: false }}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await user.click(screen.getByTestId('profile-actions-p1-menu-trigger'))
    const deleteItem = await screen.findByTestId('profile-actions-p1-item-delete')
    expect(deleteItem).toHaveAttribute('data-disabled', '')
  })

  it('disables Edit item for the default profile', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProfileCard
        profile={{ ...baseProfile, name: 'default', isActive: false }}
        onActivate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    await user.click(screen.getByTestId('profile-actions-p1-menu-trigger'))
    const editItem = await screen.findByTestId('profile-actions-p1-item-edit')
    expect(editItem).toHaveAttribute('data-disabled', '')
  })

  it('shows correct override counts', () => {
    const profile: Profile = {
      ...baseProfile,
      serverOverrides: { s1: { enabled: true }, s2: { enabled: false } },
      ruleOverrides: { r1: { enabled: true } },
    }
    renderWithProviders(
      <ProfileCard profile={profile} onActivate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByTestId('profile-server-overrides-p1')).toHaveTextContent(
      '2 MCP server overrides',
    )
    expect(screen.getByTestId('profile-rule-overrides-p1')).toHaveTextContent('1 rule override')
  })

  it('uses singular "override" when count is 1', () => {
    const profile: Profile = {
      ...baseProfile,
      serverOverrides: { s1: { enabled: true } },
      ruleOverrides: {},
    }
    renderWithProviders(
      <ProfileCard profile={profile} onActivate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByTestId('profile-server-overrides-p1')).toHaveTextContent(
      '1 MCP server override',
    )
  })
})
