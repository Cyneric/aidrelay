/**
 * @file src/renderer/components/profiles/__tests__/ProfileEditor.test.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Unit tests for the ProfileEditor drawer. Verifies heading text,
 * close interactions, and that create/update store methods are called correctly
 * on form submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ProfileEditor } from '../ProfileEditor'
import type { Profile } from '@shared/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/stores/profiles.store', () => ({
  useProfilesStore: () => ({
    create: mockCreate,
    update: mockUpdate,
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

describe('ProfileEditor', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    mockUpdate.mockReset()
  })

  it('renders "Add profile" heading when no profile prop', () => {
    renderWithProviders(<ProfileEditor onClose={vi.fn()} />)
    expect(screen.getByText('Add profile')).toBeInTheDocument()
  })

  it('renders "Edit: <name>" heading when profile prop provided', () => {
    renderWithProviders(<ProfileEditor profile={baseProfile} onClose={vi.fn()} />)
    expect(screen.getByText('Edit: Work Mode')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    renderWithProviders(<ProfileEditor onClose={onClose} />)
    await userEvent.click(screen.getByTestId('profile-editor-close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    renderWithProviders(<ProfileEditor onClose={onClose} />)
    await userEvent.click(screen.getByTestId('profile-editor-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders the profile form inside the drawer', () => {
    renderWithProviders(<ProfileEditor onClose={vi.fn()} />)
    expect(screen.getByTestId('profile-form')).toBeInTheDocument()
  })

  it('calls store create with form values on new-profile submit', async () => {
    mockCreate.mockResolvedValue({ id: 'new', name: 'Test' })
    renderWithProviders(<ProfileEditor onClose={vi.fn()} />)

    await userEvent.clear(screen.getByTestId('profile-name-input'))
    await userEvent.type(screen.getByTestId('profile-name-input'), 'Test')
    await userEvent.click(screen.getByTestId('profile-form-submit'))

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test' }))
  })

  it('calls store update when editing an existing profile', async () => {
    mockUpdate.mockResolvedValue({ id: 'p1', name: 'Updated' })
    renderWithProviders(<ProfileEditor profile={baseProfile} onClose={vi.fn()} />)

    const nameInput = screen.getByTestId('profile-name-input')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Updated')
    await userEvent.click(screen.getByTestId('profile-form-submit'))

    expect(mockUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Updated' }))
  })
})
