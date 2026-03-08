/**
 * @file src/renderer/stores/profiles.store.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Zustand store for AI configuration profiles. Mirrors the shape
 * of `servers.store.ts` — optimistic local state updates for delete, IPC
 * calls for all mutations, and a single `load()` to hydrate from the DB.
 */

import { create } from 'zustand'
import type { Profile, SyncResult } from '@shared/types'
import type { CreateProfileInput, UpdateProfileInput } from '@shared/channels'
import { profilesService } from '@/services/profiles.service'

// ─── State Shape ──────────────────────────────────────────────────────────────

interface ProfilesState {
  /** All profiles loaded from the DB. */
  profiles: Profile[]
  /** True while any async operation is in flight. */
  loading: boolean
  /** Last error message, or `null` when there is none. */
  error: string | null

  /** Loads all profiles from the main process. */
  load: () => Promise<void>
  /** Creates a new profile. */
  create: (input: CreateProfileInput) => Promise<Profile | null>
  /** Updates an existing profile. */
  update: (id: string, updates: UpdateProfileInput) => Promise<Profile | null>
  /**
   * Deletes a profile. Optimistically removes from local state; restores on
   * error.
   */
  delete: (id: string) => Promise<void>
  /**
   * Activates a profile, applies its overrides, and syncs all clients.
   * Returns the sync results from the main process.
   */
  activate: (id: string) => Promise<SyncResult[]>
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  profiles: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const profiles = await profilesService.list()
      set({ profiles, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load profiles' })
    }
  },

  create: async (input) => {
    try {
      const profile = await profilesService.create(input)
      set((s) => ({
        profiles: [...s.profiles, profile].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      return profile
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create profile' })
      return null
    }
  },

  update: async (id, updates) => {
    try {
      const profile = await profilesService.update(id, updates)
      set((s) => ({
        profiles: s.profiles.map((p) => (p.id === id ? profile : p)),
      }))
      return profile
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update profile' })
      return null
    }
  },

  delete: async (id) => {
    const snapshot = get().profiles
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }))
    try {
      await profilesService.remove(id)
    } catch (err) {
      set({
        profiles: snapshot,
        error: err instanceof Error ? err.message : 'Failed to delete profile',
      })
    }
  },

  activate: async (id) => {
    try {
      const results = await profilesService.activate(id)
      // Reload to reflect the updated isActive flags
      await get().load()
      return results
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to activate profile' })
      return []
    }
  },
}))
