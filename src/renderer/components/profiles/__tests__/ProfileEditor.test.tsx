/**
 * @file src/renderer/components/profiles/__tests__/ProfileEditor.test.tsx
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
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

const profileWithPresetIcon: Profile = {
  ...baseProfile,
  id: 'p2',
  icon: '💻',
}

const profileWithLegacyIcon: Profile = {
  ...baseProfile,
  id: 'p3',
  icon: '🏗️',
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
    expect(screen.queryByTestId('profile-icon-input')).not.toBeInTheDocument()
    expect(screen.getByTestId('icon-clear')).toBeInTheDocument()
    expect(screen.getByTestId('icon-option-0')).toBeInTheDocument()
  })

  it('calls store create with selected preset icon on new-profile submit', async () => {
    mockCreate.mockResolvedValue({ id: 'new', name: 'Test' })
    renderWithProviders(<ProfileEditor onClose={vi.fn()} />)

    await userEvent.clear(screen.getByTestId('profile-name-input'))
    await userEvent.type(screen.getByTestId('profile-name-input'), 'Test')
    await userEvent.click(screen.getByTestId('icon-option-0'))
    expect(screen.getByTestId('icon-option-0')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('icon-clear')).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByTestId('profile-form-submit'))

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test', icon: '🚀' }))
  })

  it('omits icon from create payload after clearing', async () => {
    mockCreate.mockResolvedValue({ id: 'new', name: 'Test' })
    renderWithProviders(<ProfileEditor onClose={vi.fn()} />)

    await userEvent.clear(screen.getByTestId('profile-name-input'))
    await userEvent.type(screen.getByTestId('profile-name-input'), 'Test')
    await userEvent.click(screen.getByTestId('icon-option-1'))
    await userEvent.click(screen.getByTestId('icon-clear'))
    await userEvent.click(screen.getByTestId('profile-form-submit'))

    const firstCall = mockCreate.mock.calls[0]
    expect(firstCall).toBeDefined()
    const [payload] = firstCall as [Record<string, unknown>]
    expect(payload.icon).toBeUndefined()
  })

  it('toggles pressed states between "None" and selected icon', async () => {
    renderWithProviders(<ProfileEditor onClose={vi.fn()} />)

    const clearButton = screen.getByTestId('icon-clear')
    const firstIcon = screen.getByTestId('icon-option-0')

    expect(clearButton).toHaveAttribute('aria-pressed', 'true')
    expect(firstIcon).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(firstIcon)
    expect(firstIcon).toHaveAttribute('aria-pressed', 'true')
    expect(clearButton).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(clearButton)
    expect(clearButton).toHaveAttribute('aria-pressed', 'true')
    expect(firstIcon).toHaveAttribute('aria-pressed', 'false')
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

  it('preselects preset icon in edit mode', () => {
    renderWithProviders(<ProfileEditor profile={profileWithPresetIcon} onClose={vi.fn()} />)
    expect(screen.getByTestId('icon-option-1')).toHaveAttribute('aria-pressed', 'true')
  })

  it('preserves a legacy non-preset icon if unchanged in edit mode', async () => {
    mockUpdate.mockResolvedValue({ id: 'p3', name: 'Work Mode' })
    renderWithProviders(<ProfileEditor profile={profileWithLegacyIcon} onClose={vi.fn()} />)

    await userEvent.click(screen.getByTestId('profile-form-submit'))

    expect(mockUpdate).toHaveBeenCalledWith('p3', expect.objectContaining({ icon: '🏗️' }))
  })

  it('uses class-based selected styling for icon and colour options', async () => {
    renderWithProviders(<ProfileEditor onClose={vi.fn()} />)

    const iconButton = screen.getByTestId('icon-option-0')
    await userEvent.click(iconButton)
    expect(iconButton).toHaveClass(
      'ring-2',
      'ring-primary',
      'ring-offset-2',
      'ring-offset-background',
    )

    const colorButton = screen.getByTestId('color-swatch-#8b5cf6')
    await userEvent.click(colorButton)
    expect(colorButton).toHaveClass(
      'ring-2',
      'ring-primary',
      'ring-offset-2',
      'ring-offset-background',
    )

    const style = colorButton.getAttribute('style') ?? ''
    expect(style).toContain('background-color')
    expect(style).not.toContain('--background')
    expect(style).not.toContain('--primary')
  })
})
