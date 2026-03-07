/**
 * @file src/renderer/stores/rules.store.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Zustand store for AI rules registry state. Components
 * subscribe here instead of calling `window.api` directly so rule data
 * is shared across the component tree without duplicate IPC calls.
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { AiRule, ClientId } from '@shared/types'
import type { CreateRuleInput, UpdateRuleInput } from '@shared/channels'
import '../lib/ipc'

// ─── State Shape ──────────────────────────────────────────────────────────────

interface RulesState {
  /** All AI rules in the local registry, ordered by category then name. */
  rules: AiRule[]

  /** True while any IPC call is in flight. */
  loading: boolean

  /** Error from the last operation, or `null` when all is well. */
  error: string | null

  /**
   * Loads all rules from the main process registry.
   * Safe to call multiple times — each call refreshes the list.
   */
  load: () => Promise<void>

  /**
   * Creates a new rule and appends it to the local list.
   *
   * @param input - Fields required to create the rule.
   * @returns The created `AiRule`, or `null` on error.
   */
  create: (input: CreateRuleInput) => Promise<AiRule | null>

  /**
   * Applies a partial update to an existing rule.
   * Uses an optimistic update: the local list is patched immediately,
   * then rolled back if the IPC call fails.
   *
   * @param id - UUID of the rule to update.
   * @param updates - Fields to change.
   * @returns The updated `AiRule`, or `null` on error.
   */
  update: (id: string, updates: UpdateRuleInput) => Promise<AiRule | null>

  /**
   * Deletes a rule by UUID.
   * Optimistically removes it from the local list before the IPC call.
   *
   * @param id - UUID of the rule to delete.
   */
  delete: (id: string) => Promise<void>

  /**
   * Toggles the global enabled flag for a single rule.
   *
   * @param id - UUID of the rule to toggle.
   */
  toggleEnabled: (id: string) => Promise<void>

  /**
   * Sets the enabled state for a rule on a specific client.
   *
   * @param id - Rule UUID.
   * @param clientId - The client to override.
   * @param enabled - The desired enabled state.
   */
  setClientOverride: (id: string, clientId: ClientId, enabled: boolean) => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Shared Zustand store for the AI rules registry.
 * Use the `useRulesStore` hook in any component that needs rule data.
 */
export const useRulesStore = create<RulesState>((set, get) => ({
  rules: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const rules = await window.api.rulesList()
      set({ rules, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load rules'
      set({ loading: false, error: message })
    }
  },

  create: async (input) => {
    try {
      const rule = await window.api.rulesCreate(input)
      set((state) => ({
        rules: [...state.rules, rule].sort((a, b) =>
          a.category !== b.category
            ? a.category.localeCompare(b.category)
            : a.name.localeCompare(b.name),
        ),
      }))
      return rule
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create rule'
      toast.error(message)
      return null
    }
  },

  update: async (id, updates) => {
    const previous = get().rules
    // Optimistic update
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }))
    try {
      const rule = await window.api.rulesUpdate(id, updates)
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? rule : r)),
      }))
      return rule
    } catch (err) {
      // Roll back
      set({ rules: previous })
      const message = err instanceof Error ? err.message : 'Failed to update rule'
      toast.error(message)
      return null
    }
  },

  delete: async (id) => {
    const previous = get().rules
    // Optimistic remove
    set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }))
    try {
      await window.api.rulesDelete(id)
    } catch (err) {
      set({ rules: previous })
      const message = err instanceof Error ? err.message : 'Failed to delete rule'
      toast.error(message)
    }
  },

  toggleEnabled: async (id) => {
    const rule = get().rules.find((r) => r.id === id)
    if (!rule) return
    await get().update(id, { enabled: !rule.enabled })
  },

  setClientOverride: async (id, clientId, enabled) => {
    await get().update(id, { clientOverrides: { [clientId]: { enabled } } })
  },
}))
