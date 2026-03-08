/**
 * @file src/renderer/components/profiles/__tests__/ProfileDiffView.test.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for the ProfileDiffView confirmation modal. Verifies
 * empty-override messaging, section rendering, arrow rendering for changed
 * items, button callbacks, and loading state.
 */

import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ProfileDiffView } from '../ProfileDiffView'
import type { Profile } from '@shared/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/stores/servers.store', () => ({
  useServersStore: () => ({
    servers: [
      { id: 's1', name: 'My Server', enabled: true },
      { id: 's2', name: 'Other Server', enabled: false },
    ],
  }),
}))

vi.mock('@/stores/rules.store', () => ({
  useRulesStore: () => ({
    rules: [{ id: 'r1', name: 'My Rule', enabled: false }],
  }),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseProfile: Profile = {
  id: 'p1',
  name: 'Work Mode',
  description: '',
  icon: '',
  color: '#6366f1',
  isActive: false,
  serverOverrides: {},
  ruleOverrides: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileDiffView', () => {
  it('shows no-overrides message when profile has no overrides', () => {
    renderWithProviders(
      <ProfileDiffView profile={baseProfile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText(/no server or rule overrides/i)).toBeInTheDocument()
  })

  it('shows Server changes section for serverOverrides', () => {
    const profile = { ...baseProfile, serverOverrides: { s1: { enabled: false } } }
    renderWithProviders(
      <ProfileDiffView profile={profile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('Server changes')).toBeInTheDocument()
    expect(screen.getByText('My Server')).toBeInTheDocument()
  })

  it('shows Rule changes section for ruleOverrides', () => {
    const profile = { ...baseProfile, ruleOverrides: { r1: { enabled: true } } }
    renderWithProviders(
      <ProfileDiffView profile={profile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('Rule changes')).toBeInTheDocument()
    expect(screen.getByText('My Rule')).toBeInTheDocument()
  })

  it('calls onConfirm when Activate profile button clicked', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ProfileDiffView profile={baseProfile} onConfirm={onConfirm} onCancel={vi.fn()} />,
    )
    await userEvent.click(screen.getByTestId('profile-diff-confirm'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when Cancel button clicked', async () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <ProfileDiffView profile={baseProfile} onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    await userEvent.click(screen.getByTestId('profile-diff-cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <ProfileDiffView profile={baseProfile} onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables confirm button while activating', () => {
    renderWithProviders(
      <ProfileDiffView profile={baseProfile} activating onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByTestId('profile-diff-confirm')).toBeDisabled()
    expect(screen.getByTestId('profile-diff-confirm')).toHaveTextContent('Activating…')
  })

  it('falls back to item ID when server not found in store', () => {
    const profile = { ...baseProfile, serverOverrides: { 'unknown-id': { enabled: false } } }
    renderWithProviders(
      <ProfileDiffView profile={profile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('unknown-id')).toBeInTheDocument()
  })

  it('shows profile name in heading', () => {
    renderWithProviders(
      <ProfileDiffView profile={baseProfile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Work Mode/)).toBeInTheDocument()
  })
})
