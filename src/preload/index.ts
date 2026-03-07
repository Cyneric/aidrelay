/**
 * @file src/preload/index.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Preload script that runs in a privileged context before the
 * renderer loads. Exposes a typed IPC bridge to the renderer via
 * contextBridge. Only whitelisted methods are accessible — never raw
 * ipcRenderer. IPC channels are added here as each domain is implemented.
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { ClientId, ClientStatus, McpServerMap, SyncResult } from '../shared/types'

/**
 * The typed API surface exposed to the renderer process.
 * Accessible in the renderer as `window.api`.
 */
const api = {
  // ── Clients ───────────────────────────────────────────────────────────────

  /**
   * Detects all registered clients and returns their current status.
   *
   * @returns Array of `ClientStatus` for every supported client.
   */
  clientsDetectAll: (): Promise<ClientStatus[]> => ipcRenderer.invoke('clients:detect-all'),

  /**
   * Reads the current MCP server map from a specific client's config.
   *
   * @param clientId - The client to read from.
   * @returns Map of server name → raw config.
   */
  clientsReadConfig: (clientId: ClientId): Promise<McpServerMap> =>
    ipcRenderer.invoke('clients:read-config', clientId),

  /**
   * Syncs all enabled aidrelay servers to a single client's config.
   *
   * @param clientId - The client to sync.
   * @returns Sync result with success flag and server count.
   */
  clientsSync: (clientId: ClientId): Promise<SyncResult> =>
    ipcRenderer.invoke('clients:sync', clientId),

  /**
   * Syncs all enabled aidrelay servers to every installed client's config.
   *
   * @returns Array of sync results, one per synced client.
   */
  clientsSyncAll: (): Promise<SyncResult[]> => ipcRenderer.invoke('clients:sync-all'),
} as const

// Expose the typed bridge to the renderer process
contextBridge.exposeInMainWorld('api', api)

/** Type of the API object exposed to the renderer via `window.api`. */
export type ElectronApi = typeof api
