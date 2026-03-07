/**
 * @file src/preload/index.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Preload script that runs in a privileged context before the
 * renderer loads. Exposes a typed IPC bridge to the renderer via
 * contextBridge. Only whitelisted methods are accessible — never raw
 * ipcRenderer. IPC channels are added here as each domain is implemented.
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { ClientId, ClientStatus, McpServer, McpServerMap, SyncResult } from '../shared/types'
import type {
  CreateServerInput,
  UpdateServerInput,
  ActivityLogEntry,
  LogFilters,
} from '../shared/channels'

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

  // ── Servers ───────────────────────────────────────────────────────────────

  /**
   * Returns all MCP server records from the local registry.
   *
   * @returns Array of all `McpServer` entries ordered by name.
   */
  serversList: (): Promise<McpServer[]> => ipcRenderer.invoke('servers:list'),

  /**
   * Returns a single server by its UUID, or `null` if not found.
   *
   * @param id - The server UUID to look up.
   */
  serversGet: (id: string): Promise<McpServer | null> => ipcRenderer.invoke('servers:get', id),

  /**
   * Creates a new MCP server entry in the local registry.
   *
   * @param input - Fields required to create the server.
   * @returns The persisted `McpServer`.
   */
  serversCreate: (input: CreateServerInput): Promise<McpServer> =>
    ipcRenderer.invoke('servers:create', input),

  /**
   * Applies a partial update to an existing server.
   *
   * @param id - UUID of the server to update.
   * @param updates - The fields to change.
   * @returns The updated `McpServer`.
   */
  serversUpdate: (id: string, updates: UpdateServerInput): Promise<McpServer> =>
    ipcRenderer.invoke('servers:update', id, updates),

  /**
   * Permanently removes a server from the local registry.
   *
   * @param id - UUID of the server to delete.
   */
  serversDelete: (id: string): Promise<void> => ipcRenderer.invoke('servers:delete', id),

  // ── Activity Log ──────────────────────────────────────────────────────────

  /**
   * Queries the activity log with optional filters.
   *
   * @param filters - Optional constraints: action type, client, server, date, limit.
   * @returns Matching log entries in descending chronological order.
   */
  logQuery: (filters: LogFilters): Promise<ActivityLogEntry[]> =>
    ipcRenderer.invoke('log:query', filters),
} as const

// Expose the typed bridge to the renderer process
contextBridge.exposeInMainWorld('api', api)

/** Type of the API object exposed to the renderer via `window.api`. */
export type ElectronApi = typeof api
