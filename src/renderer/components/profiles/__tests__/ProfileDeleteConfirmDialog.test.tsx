import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { ProfileDeleteConfirmDialog } from '../ProfileDeleteConfirmDialog'
import type { Profile } from '@shared/types'

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

describe('ProfileDeleteConfirmDialog', () => {
  it('renders warning copy with target profile name', () => {
    renderWithProviders(
      <ProfileDeleteConfirmDialog profile={baseProfile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.getByTestId('profile-delete-dialog')).toBeInTheDocument()
    expect(screen.getByText(/Delete profile\?/i)).toBeInTheDocument()
    expect(screen.getByTestId('profile-delete-confirmation-label')).toHaveTextContent(
      'Type "Work Mode" to confirm',
    )
  })

  it('keeps confirm disabled until name matches', async () => {
    renderWithProviders(
      <ProfileDeleteConfirmDialog profile={baseProfile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    const input = screen.getByTestId('profile-delete-confirmation-input')
    const confirm = screen.getByTestId('profile-delete-confirm')
    expect(confirm).toBeDisabled()

    await userEvent.type(input, 'something else')
    expect(confirm).toBeDisabled()
  })

  it('enables confirm for trimmed, case-insensitive name match', async () => {
    renderWithProviders(
      <ProfileDeleteConfirmDialog profile={baseProfile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    const input = screen.getByTestId('profile-delete-confirmation-input')
    const confirm = screen.getByTestId('profile-delete-confirm')

    await userEvent.type(input, '  work mode  ')
    expect(confirm).toBeEnabled()
  })

  it('calls onConfirm when delete is clicked after valid match', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ProfileDeleteConfirmDialog profile={baseProfile} onConfirm={onConfirm} onCancel={vi.fn()} />,
    )

    await userEvent.type(screen.getByTestId('profile-delete-confirmation-input'), 'work mode')
    await userEvent.click(screen.getByTestId('profile-delete-confirm'))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('resets input when opened for another profile', async () => {
    const { rerender } = renderWithProviders(
      <ProfileDeleteConfirmDialog profile={baseProfile} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    await userEvent.type(screen.getByTestId('profile-delete-confirmation-input'), 'work mode')
    expect(screen.getByTestId('profile-delete-confirm')).toBeEnabled()

    rerender(
      <ProfileDeleteConfirmDialog
        profile={{ ...baseProfile, id: 'p2', name: 'Personal' }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByTestId('profile-delete-confirmation-input')).toHaveValue('')
    expect(screen.getByTestId('profile-delete-confirm')).toBeDisabled()
  })
})
