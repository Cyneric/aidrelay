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
    renderWithProviders(<ProfilesPage />)

    await userEvent.click(screen.getByTestId('profile-delete-p1'))
    expect(screen.getByTestId('profile-delete-dialog')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('confirms deletion only after matching profile name', async () => {
    renderWithProviders(<ProfilesPage />)

    await userEvent.click(screen.getByTestId('profile-delete-p1'))

    const input = screen.getByTestId('profile-delete-confirmation-input')
    const confirm = screen.getByTestId('profile-delete-confirm')

    expect(confirm).toBeDisabled()

    await userEvent.type(input, 'work mode')
    expect(confirm).toBeEnabled()

    await userEvent.click(confirm)

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('p1'))
    await waitFor(() =>
      expect(screen.queryByTestId('profile-delete-dialog')).not.toBeInTheDocument(),
    )
  })

  it('closes dialog on cancel without deleting', async () => {
    renderWithProviders(<ProfilesPage />)

    await userEvent.click(screen.getByTestId('profile-delete-p1'))
    await userEvent.click(screen.getByTestId('profile-delete-cancel'))

    expect(mockDelete).not.toHaveBeenCalled()
    expect(screen.queryByTestId('profile-delete-dialog')).not.toBeInTheDocument()
  })
})
