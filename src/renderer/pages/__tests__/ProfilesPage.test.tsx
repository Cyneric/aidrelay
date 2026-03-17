/**
 * @file src/renderer/pages/__tests__/ProfilesPage.test.tsx
 *
 * @created 08.03.2026
 * @modified 17.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unit tests for ProfilesPage. Verifies delete confirmation flow
 * using the RowActions dropdown pattern.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test-utils'
import { ProfilesPage } from '../ProfilesPage'
import type { Profile } from '@shared/types'

const mockDelete = vi.fn<(id: string) => Promise<void>>()
const mockLoadProfiles = vi.fn<() => Promise<void>>()
const mockActivate = vi.fn<(id: string) => Promise<unknown[]>>()
const mockLoadServers = vi.fn<() => Promise<void>>()
const mockLoadRules = vi.fn<() => Promise<void>>()

const profile: Profile = {
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

vi.mock('@/stores/profiles.store', () => ({
  useProfilesStore: () => ({
    profiles: [profile],
    loading: false,
    error: null,
    load: mockLoadProfiles,
    delete: mockDelete,
    activate: mockActivate,
  }),
}))

vi.mock('@/stores/servers.store', () => ({
  useServersStore: () => ({
    load: mockLoadServers,
  }),
}))

vi.mock('@/stores/rules.store', () => ({
  useRulesStore: () => ({
    load: mockLoadRules,
  }),
}))

describe('ProfilesPage delete confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDelete.mockResolvedValue(undefined)
    mockLoadProfiles.mockResolvedValue()
    mockActivate.mockResolvedValue([])
    mockLoadServers.mockResolvedValue()
    mockLoadRules.mockResolvedValue()
  })

  it('opens typed-name confirmation dialog before deleting', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPage />)

    // Open the dropdown menu for this profile
    const menuTrigger = screen.getByTestId('profile-actions-p1-menu-trigger')
    await user.click(menuTrigger)

    // Click the delete item in the dropdown
    const deleteItem = await screen.findByTestId('profile-actions-p1-item-delete')
    await user.click(deleteItem)

    expect(screen.getByTestId('profile-delete-dialog')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('confirms deletion only after matching profile name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPage />)

    // Open dropdown and click delete
    await user.click(screen.getByTestId('profile-actions-p1-menu-trigger'))
    const deleteItem = await screen.findByTestId('profile-actions-p1-item-delete')
    await user.click(deleteItem)

    const input = screen.getByTestId('profile-delete-confirmation-input')
    const confirm = screen.getByTestId('profile-delete-confirm')

    expect(confirm).toBeDisabled()

    await user.type(input, 'work mode')
    expect(confirm).toBeEnabled()

    await user.click(confirm)

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('p1'))
    await waitFor(() =>
      expect(screen.queryByTestId('profile-delete-dialog')).not.toBeInTheDocument(),
    )
  })

  it('closes dialog on cancel without deleting', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPage />)

    // Open dropdown and click delete
    await user.click(screen.getByTestId('profile-actions-p1-menu-trigger'))
    const deleteItem = await screen.findByTestId('profile-actions-p1-item-delete')
    await user.click(deleteItem)

    await user.click(screen.getByTestId('profile-delete-cancel'))

    expect(mockDelete).not.toHaveBeenCalled()
    expect(screen.queryByTestId('profile-delete-dialog')).not.toBeInTheDocument()
  })
})
