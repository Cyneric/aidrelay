import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '@shared/types'
import { useProfilesStore } from '../profiles.store'

const baseProfile: Profile = {
  id: 'p1',
  name: 'default',
  description: '',
  icon: '',
  color: '#6366f1',
  isActive: true,
  serverOverrides: {},
  ruleOverrides: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('profiles.store delete()', () => {
  beforeEach(() => {
    useProfilesStore.setState({
      profiles: [baseProfile],
      loading: false,
      error: null,
    })
  })

  it('restores profile list and stores backend error when delete fails', async () => {
    const profilesDelete = vi
      .fn()
      .mockRejectedValue(new Error('The default profile cannot be deleted'))

    Object.defineProperty(window, 'api', {
      value: {
        ...window.api,
        profilesDelete,
      },
      writable: true,
      configurable: true,
    })

    await useProfilesStore.getState().delete(baseProfile.id)

    const state = useProfilesStore.getState()
    expect(profilesDelete).toHaveBeenCalledWith(baseProfile.id)
    expect(state.error).toBe('The default profile cannot be deleted')
    expect(state.profiles).toEqual([baseProfile])
  })
})
