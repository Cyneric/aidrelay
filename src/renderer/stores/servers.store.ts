/**
 * @file src/renderer/stores/servers.store.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Zustand store for MCP server registry state. Components
 * subscribe here instead of calling `window.api` directly so server data
 * is shared across the component tree without duplicate IPC calls.
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { McpServer, ClientId } from '@shared/types'
import type { CreateServerInput, UpdateServerInput } from '@shared/channels'
import { serversService } from '@/services/servers.service'
import '../lib/ipc'

// ─── State Shape ──────────────────────────────────────────────────────────────

interface ServersState {
  /** All MCP servers in the local registry, ordered by name. */
  servers: McpServer[]

  /** True while any IPC call is in flight. */
  loading: boolean

  /** Error from the last operation, or `null` when all is well. */
  error: string | null

  /**
   * Loads all servers from the main process registry.
   * Safe to call multiple times — each call refreshes the list.
   */
  load: () => Promise<void>

  /**
   * Creates a new server and refreshes the list.
   *
   * @param input - Fields required to create the server.
   * @returns The created `McpServer`, or `null` on error.
   */
  create: (input: CreateServerInput) => Promise<McpServer | null>

  /**
   * Applies a partial update to an existing server.
   * Uses an optimistic update: the local list is patched immediately,
   * then rolled back if the IPC call fails.
   *
   * @param id - UUID of the server to update.
   * @param updates - Fields to change.
   * @returns The updated `McpServer`, or `null` on error.
   */
  update: (id: string, updates: UpdateServerInput) => Promise<McpServer | null>

  /**
   * Deletes a server by UUID.
   * Optimistically removes it from the local list before the IPC call.
   *
   * @param id - UUID of the server to delete.
   */
  delete: (id: string) => Promise<void>

  /**
   * Toggles the global enabled flag for a single server.
   *
   * @param id - UUID of the server to toggle.
   */
  toggleEnabled: (id: string) => Promise<void>

  /**
   * Sets the enabled state for a server on a specific client.
   *
   * @param id - Server UUID.
   * @param clientId - The client to override.
   * @param enabled - The desired enabled state.
   */
  setClientOverride: (id: string, clientId: ClientId, enabled: boolean) => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Shared Zustand store for the MCP server registry.
 * Use the `useServersStore` hook in any component that needs server data.
 */
export const useServersStore = create<ServersState>((set, get) => ({
  servers: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const servers = await serversService.list()
      set({ servers, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load servers'
      set({ loading: false, error: message })
    }
  },

  create: async (input) => {
    try {
      const server = await serversService.create(input)
      set((state) => ({
        servers: [...state.servers, server].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      return server
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create server'
      toast.error(message)
      return null
    }
  },

  update: async (id, updates) => {
    const previous = get().servers
    // Optimistic update
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }))
    try {
      const server = await serversService.update(id, updates)
      set((state) => ({
        servers: state.servers.map((s) => (s.id === id ? server : s)),
      }))
      return server
    } catch (err) {
      // Roll back
      set({ servers: previous })
      const message = err instanceof Error ? err.message : 'Failed to update server'
      toast.error(message)
      return null
    }
  },

  delete: async (id) => {
    const previous = get().servers
    // Optimistic remove
    set((state) => ({ servers: state.servers.filter((s) => s.id !== id) }))
    try {
      await serversService.remove(id)
    } catch (err) {
      set({ servers: previous })
      const message = err instanceof Error ? err.message : 'Failed to delete server'
      toast.error(message)
    }
  },

  toggleEnabled: async (id) => {
    const server = get().servers.find((s) => s.id === id)
    if (!server) return
    await get().update(id, { enabled: !server.enabled })
  },

  setClientOverride: async (id, clientId, enabled) => {
    await get().update(id, { clientOverrides: { [clientId]: { enabled } } })
  },
}))
