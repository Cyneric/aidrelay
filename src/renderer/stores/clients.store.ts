/**
 * @file src/renderer/stores/clients.store.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Zustand store for client detection state. Components subscribe
 * to this store instead of calling `window.api` directly so detection results
 * are shared across the component tree without duplicate IPC calls.
 */

import { create } from 'zustand'
import type { ClientStatus, SyncClientOptions, SyncResult } from '@shared/types'
import { clientsService } from '@/services/clients.service'
import '../lib/ipc'

// ─── State Shape ──────────────────────────────────────────────────────────────

interface ClientsState {
  /** Detection results for every registered client adapter. */
  clients: ClientStatus[]

  /** True while the initial detection IPC call is in flight. */
  loading: boolean

  /**
   * Error message if the last detection call failed.
   * `null` when detection succeeded or has not been attempted yet.
   */
  error: string | null

  /**
   * Fires `clients:detect-all` via IPC and stores the results.
   * Safe to call multiple times — each call refreshes the list.
   */
  detectAll: () => Promise<void>

  /**
   * Syncs a single client and refreshes the detection state afterward.
   *
   * @param clientId - The client to sync.
   */
  syncClient: (clientId: ClientStatus['id'], options?: SyncClientOptions) => Promise<SyncResult>
}

export class ClientSyncError extends Error {
  code?: SyncResult['errorCode']

  constructor(message: string, code?: SyncResult['errorCode']) {
    super(message)
    this.name = 'ClientSyncError'
    this.code = code
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Shared Zustand store for client status.
 * Use the `useClientsStore` hook in any component that needs client data.
 */
export const useClientsStore = create<ClientsState>((set) => ({
  clients: [],
  loading: false,
  error: null,

  detectAll: async () => {
    set({ loading: true, error: null })
    try {
      const clients = await clientsService.detectAll()
      set({ clients, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Detection failed'
      set({ loading: false, error: message })
    }
  },

  syncClient: async (clientId, options) => {
    const result = await clientsService.sync(clientId, options)
    // Re-detect so the UI reflects the updated state
    const clients = await clientsService.detectAll()
    set({ clients })
    if (!result.success) {
      throw new ClientSyncError(result.error ?? `Sync failed for ${clientId}`, result.errorCode)
    }
    return result
  },
}))
