/**
 * @file src/preload/index.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
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
import type {
  ClientId,
  ClientStatus,
  McpServer,
  McpServerMap,
  AiRule,
  Profile,
  SyncResult,
  LicenseStatus,
  ConfigChangedPayload,
  GitSyncStatus,
  GitPushResult,
  GitPullResult,
  ManualGitConfig,
  ValidationResult,
} from '../shared/types'
import type {
  CreateServerInput,
  UpdateServerInput,
  CreateRuleInput,
  UpdateRuleInput,
  ImportResult,
  CreateProfileInput,
  UpdateProfileInput,
  ActivityLogEntry,
  LogFilters,
  FeatureGates,
  RegistryServer,
  TestResult,
  BackupEntry,
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

  /**
   * Validates a client's config file against the expected JSON schema.
   * Returns a `ValidationResult` with `valid` flag and any error messages.
   *
   * @param clientId - The client whose config to validate.
   * @returns Validation result.
   */
  clientsValidateConfig: (clientId: ClientId): Promise<ValidationResult> =>
    ipcRenderer.invoke('clients:validate-config', clientId),

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

  /**
   * Imports servers from all installed clients' config files into the registry.
   * Skips servers that already exist (by name). Returns counts and any errors.
   */
  serversImportFromClients: (): Promise<ImportResult> =>
    ipcRenderer.invoke('servers:import-from-clients'),

  // ── Rules ─────────────────────────────────────────────────────────────────

  /**
   * Returns all AI rule records from the local registry.
   *
   * @returns Array of all `AiRule` entries ordered by category, then name.
   */
  rulesList: (): Promise<AiRule[]> => ipcRenderer.invoke('rules:list'),

  /**
   * Returns a single rule by its UUID, or `null` if not found.
   *
   * @param id - The rule UUID to look up.
   */
  rulesGet: (id: string): Promise<AiRule | null> => ipcRenderer.invoke('rules:get', id),

  /**
   * Creates a new AI rule in the local registry. Token estimate is calculated
   * automatically by the main process and persisted to the database.
   *
   * @param input - Fields required to create the rule.
   * @returns The persisted `AiRule` with a populated `tokenEstimate`.
   */
  rulesCreate: (input: CreateRuleInput): Promise<AiRule> =>
    ipcRenderer.invoke('rules:create', input),

  /**
   * Applies a partial update to an existing rule. If `content` is included,
   * the token estimate is recalculated and persisted automatically.
   *
   * @param id - UUID of the rule to update.
   * @param updates - The fields to change.
   * @returns The updated `AiRule`.
   */
  rulesUpdate: (id: string, updates: UpdateRuleInput): Promise<AiRule> =>
    ipcRenderer.invoke('rules:update', id, updates),

  /**
   * Permanently removes a rule from the local registry.
   *
   * @param id - UUID of the rule to delete.
   */
  rulesDelete: (id: string): Promise<void> => ipcRenderer.invoke('rules:delete', id),

  /**
   * Estimates the token count for a piece of Markdown content using the
   * word-count heuristic (words × 1.3, rounded up). Used by the editor for
   * live feedback without persisting anything to the database.
   *
   * @param content - The raw Markdown text to estimate.
   * @returns Estimated token count.
   */
  rulesEstimateTokens: (content: string): Promise<number> =>
    ipcRenderer.invoke('rules:estimate-tokens', content),

  /**
   * Syncs all enabled rules to a single client's config paths.
   *
   * @param clientId - The client to sync rules to.
   * @returns Sync result with success flag and rule file count.
   */
  rulesSyncToClient: (clientId: ClientId): Promise<SyncResult> =>
    ipcRenderer.invoke('rules:sync', clientId),

  /**
   * Syncs all enabled rules to every installed client's config paths.
   *
   * @returns Array of sync results, one per synced client.
   */
  rulesSyncAll: (): Promise<SyncResult[]> => ipcRenderer.invoke('rules:sync-all'),

  /**
   * Scans VS Code and Cursor workspace history to suggest recent project
   * directories for the rule import dialog.
   *
   * @returns Array of absolute directory paths, deduplicated.
   */
  rulesDetectWorkspaces: (): Promise<string[]> => ipcRenderer.invoke('rules:detect-workspaces'),

  /**
   * Bulk-imports rules from an existing project directory. Scans for
   * `.cursor/rules/*.mdc`, `CLAUDE.md`, `AGENTS.md`, `.windsurfrules`, etc.
   *
   * @param dirPath - Absolute path to the project root to scan.
   * @returns Import result with counts of imported, skipped, and errored rules.
   */
  rulesImportFromProject: (dirPath: string): Promise<ImportResult> =>
    ipcRenderer.invoke('rules:import-from-project', dirPath),

  // ── Profiles ──────────────────────────────────────────────────────────────

  /**
   * Returns all profiles ordered by name.
   *
   * @returns Array of all profiles.
   */
  profilesList: (): Promise<Profile[]> => ipcRenderer.invoke('profiles:list'),

  /**
   * Returns a single profile by ID, or `null` if not found.
   *
   * @param id - Profile UUID.
   */
  profilesGet: (id: string): Promise<Profile | null> => ipcRenderer.invoke('profiles:get', id),

  /**
   * Creates a new profile.
   *
   * @param input - Name and optional metadata for the new profile.
   * @returns The newly created profile.
   */
  profilesCreate: (input: CreateProfileInput): Promise<Profile> =>
    ipcRenderer.invoke('profiles:create', input),

  /**
   * Updates an existing profile's fields.
   *
   * @param id      - UUID of the profile to update.
   * @param updates - Fields to change.
   * @returns The updated profile.
   */
  profilesUpdate: (id: string, updates: UpdateProfileInput): Promise<Profile> =>
    ipcRenderer.invoke('profiles:update', id, updates),

  /**
   * Deletes a profile by ID.
   * Throws if the profile is currently active.
   *
   * @param id - UUID of the profile to delete.
   */
  profilesDelete: (id: string): Promise<void> => ipcRenderer.invoke('profiles:delete', id),

  /**
   * Activates a profile: marks it active, applies server and rule overrides,
   * then syncs all installed clients.
   *
   * @param id - UUID of the profile to activate.
   * @returns Sync results for each client that was synced.
   */
  profilesActivate: (id: string): Promise<SyncResult[]> =>
    ipcRenderer.invoke('profiles:activate', id),

  // ── Secrets ───────────────────────────────────────────────────────────────

  /**
   * Stores or updates a secret value in Windows Credential Manager.
   *
   * @param serverName - The MCP server this secret belongs to.
   * @param key        - The environment variable key name.
   * @param value      - The plaintext secret value to store.
   */
  secretsSet: (serverName: string, key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('secrets:set', serverName, key, value),

  /**
   * Retrieves a secret value from Windows Credential Manager.
   *
   * @param serverName - The MCP server this secret belongs to.
   * @param key        - The environment variable key name.
   * @returns The stored value, or `null` if not found.
   */
  secretsGet: (serverName: string, key: string): Promise<string | null> =>
    ipcRenderer.invoke('secrets:get', serverName, key),

  /**
   * Removes a single secret from Windows Credential Manager.
   *
   * @param serverName - The MCP server this secret belongs to.
   * @param key        - The environment variable key name.
   */
  secretsDelete: (serverName: string, key: string): Promise<void> =>
    ipcRenderer.invoke('secrets:delete', serverName, key),

  /**
   * Lists all env key names that have secrets stored for a given server.
   *
   * @param serverName - The MCP server to list secrets for.
   * @returns Array of env key names.
   */
  secretsListKeys: (serverName: string): Promise<string[]> =>
    ipcRenderer.invoke('secrets:list-keys', serverName),

  /**
   * Removes all secrets stored for a given server. Call this when deleting
   * a server to avoid leaving orphaned credentials in the OS store.
   *
   * @param serverName - The MCP server whose secrets should all be removed.
   */
  secretsDeleteAll: (serverName: string): Promise<void> =>
    ipcRenderer.invoke('secrets:delete-all', serverName),

  // ── License ───────────────────────────────────────────────────────────────

  /**
   * Activates a license-provider license key. Validates with the API and caches
   * the result via `electron.safeStorage`.
   *
   * @param key - The license key to activate.
   * @returns The resulting license status.
   */
  licenseActivate: (key: string): Promise<LicenseStatus> =>
    ipcRenderer.invoke('license:activate', key),

  /**
   * Deactivates the current license and clears the local cache.
   */
  licenseDeactivate: (): Promise<void> => ipcRenderer.invoke('license:deactivate'),

  /**
   * Returns the cached license status without making a network call.
   * The main process re-validates in the background when the cache is stale.
   *
   * @returns Current license status.
   */
  licenseStatus: (): Promise<LicenseStatus> => ipcRenderer.invoke('license:status'),

  /**
   * Returns the feature gate values for the current license tier.
   * Components should use `useFeatureGate()` instead of calling this directly.
   *
   * @returns Active feature gates object.
   */
  licenseFeatureGates: (): Promise<FeatureGates> => ipcRenderer.invoke('license:feature-gates'),

  // ── Activity Log ──────────────────────────────────────────────────────────

  /**
   * Queries the activity log with optional filters.
   *
   * @param filters - Optional constraints: action type, client, server, date, limit.
   * @returns Matching log entries in descending chronological order.
   */
  logQuery: (filters: LogFilters): Promise<ActivityLogEntry[]> =>
    ipcRenderer.invoke('log:query', filters),

  // ── Git Sync ──────────────────────────────────────────────────────────────

  /**
   * Returns the current git sync connection status and config.
   *
   * @returns Status object indicating whether git sync is configured.
   */
  gitSyncStatus: (): Promise<GitSyncStatus> => ipcRenderer.invoke('git-sync:status'),

  /**
   * Runs the GitHub OAuth quick setup flow. Opens the system browser, waits
   * for the callback, creates/reuses the private sync repo, and clones it.
   *
   * @returns The updated sync status after a successful connection.
   */
  gitSyncConnectGitHub: (): Promise<GitSyncStatus> => ipcRenderer.invoke('git-sync:connect-github'),

  /**
   * Configures git sync using a manually provided remote URL and auth token.
   *
   * @param config - Remote URL, optional branch, and auth token.
   * @returns The updated sync status after a successful connection.
   */
  gitSyncConnectManual: (config: ManualGitConfig): Promise<GitSyncStatus> =>
    ipcRenderer.invoke('git-sync:connect-manual', config),

  /**
   * Disconnects git sync and removes the local clone and stored credentials.
   */
  gitSyncDisconnect: (): Promise<void> => ipcRenderer.invoke('git-sync:disconnect'),

  /**
   * Exports the current registry to JSON files, commits, and pushes to the
   * configured remote.
   *
   * @returns Push result with success flag and commit hash.
   */
  gitSyncPush: (): Promise<GitPushResult> => ipcRenderer.invoke('git-sync:push'),

  /**
   * Fetches the remote, force-resets the local branch, and imports all
   * entities from the pulled JSON files into the local DB.
   *
   * @returns Pull result with imported entity counts and conflict count.
   */
  gitSyncPull: (): Promise<GitPullResult> => ipcRenderer.invoke('git-sync:pull'),

  // ── Registry ──────────────────────────────────────────────────────────────

  /**
   * Searches the Smithery registry for MCP servers matching the query.
   * Returns an empty array if no API key is configured or the request fails.
   *
   * @param query - Free-text search string.
   * @returns Matching registry server entries.
   */
  registrySearch: (query: string): Promise<RegistryServer[]> =>
    ipcRenderer.invoke('registry:search', query),

  /**
   * Installs a registry server by its qualified name (Pro only).
   * Creates a new MCP server entry using `npx -y <qualifiedName>`.
   *
   * @param qualifiedName - Smithery qualified name (e.g. `@anthropic/github-mcp`).
   * @returns The newly created `McpServer` record.
   */
  registryInstall: (qualifiedName: string): Promise<McpServer> =>
    ipcRenderer.invoke('registry:install', qualifiedName),

  // ── Stacks ────────────────────────────────────────────────────────────────

  /**
   * Exports the selected servers and rules as a portable JSON stack string
   * (Pro only). Secrets and machine-specific fields are stripped automatically.
   *
   * @param serverIds - IDs of the servers to include.
   * @param ruleIds   - IDs of the rules to include.
   * @param name      - Human-readable name for the exported stack.
   * @returns JSON string representing the `McpStack` bundle.
   */
  stacksExport: (serverIds: string[], ruleIds: string[], name: string): Promise<string> =>
    ipcRenderer.invoke('stacks:export', serverIds, ruleIds, name),

  /**
   * Imports servers and rules from a JSON stack string.
   * Duplicate entries (matched by name) are silently skipped.
   *
   * @param json - The raw JSON string of a previously exported stack.
   * @returns Import result with counts of imported, skipped, and errored entries.
   */
  stacksImport: (json: string): Promise<ImportResult> => ipcRenderer.invoke('stacks:import', json),

  // ── Server testing ────────────────────────────────────────────────────────

  /**
   * Runs a JSON-RPC `initialize` handshake against a stdio MCP server (Pro only).
   * The test process is spawned, probed, and killed automatically within 5 seconds.
   *
   * @param id - UUID of the server to test.
   * @returns Test result describing success or failure with response time.
   */
  serversTest: (id: string): Promise<TestResult> => ipcRenderer.invoke('servers:test', id),

  // ── Backups ───────────────────────────────────────────────────────────────

  /**
   * Lists all backup entries for a given client, newest first.
   *
   * @param clientId - The client whose backup history to retrieve.
   * @returns Array of `BackupEntry` records.
   */
  backupsList: (clientId: ClientId): Promise<BackupEntry[]> =>
    ipcRenderer.invoke('backups:list', clientId),

  /**
   * Restores a client config from a specific backup file. Creates a safety
   * backup of the current live config before overwriting.
   *
   * @param backupPath - Absolute path to the backup JSON file.
   * @param clientId   - The client whose config will be restored.
   */
  backupsRestore: (backupPath: string, clientId: ClientId): Promise<void> =>
    ipcRenderer.invoke('backups:restore', backupPath, clientId),

  // ── Dialog ────────────────────────────────────────────────────────────────

  /**
   * Opens the native directory/file picker dialog.
   *
   * @param options - Optional properties (openDirectory, openFile, etc.) and title.
   * @returns Object with canceled flag and selected file paths.
   */
  showOpenDialog: (options?: {
    properties?: readonly ('openDirectory' | 'openFile' | 'multiSelections')[]
    title?: string
  }): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('dialog:show-open', options ?? {}),

  /**
   * Returns the application version from package.json (via app.getVersion).
   */
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  // ── Settings ──────────────────────────────────────────────────────────────

  /**
   * Reads a persisted setting value by key.
   *
   * @param key - The setting key to look up.
   * @returns The stored value, or `null` if not set.
   */
  settingsGet: (key: string): Promise<unknown> => ipcRenderer.invoke('settings:get', key),

  /**
   * Writes a setting value (upsert semantics).
   *
   * @param key   - The setting key to write.
   * @param value - Any JSON-serializable value.
   */
  settingsSet: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),

  /**
   * Deletes a setting entry by key. No-op if the key does not exist.
   *
   * @param key - The setting key to remove.
   */
  settingsDelete: (key: string): Promise<void> => ipcRenderer.invoke('settings:delete', key),

  // ── Auto-updater ──────────────────────────────────────────────────────────

  /**
   * Manually triggers an update check. Results are delivered via push events
   * (`updater:update-available` or `updater:update-not-available`).
   */
  updaterCheck: (): Promise<void> => ipcRenderer.invoke('updater:check'),

  /**
   * Quits the application and installs the downloaded update. Only valid after
   * an `updater:update-downloaded` event has been received.
   */
  updaterInstall: (): Promise<void> => ipcRenderer.invoke('updater:install'),

  // ── Push events (main → renderer) ─────────────────────────────────────────

  /**
   * Registers a handler called when the main process detects an external
   * change to a watched client config file. Returns a cleanup function.
   *
   * @param handler - Callback receiving the change payload.
   * @returns A cleanup function that removes the listener.
   */
  onConfigChanged: (handler: (payload: ConfigChangedPayload) => void): (() => void) => {
    const wrapped = (
      _event: Parameters<Parameters<typeof ipcRenderer.on>[1]>[0],
      payload: ConfigChangedPayload,
    ) => handler(payload)
    ipcRenderer.on('clients:config-changed', wrapped)
    return () => ipcRenderer.removeListener('clients:config-changed', wrapped)
  },

  /**
   * Registers a handler called when the tray requests a profile switch.
   * The payload is the profile UUID to activate. Returns a cleanup function.
   *
   * @param handler - Callback receiving the profile ID.
   * @returns A cleanup function that removes the listener.
   */
  onActivateProfileFromTray: (handler: (profileId: string) => void): (() => void) => {
    const wrapped = (
      _event: Parameters<Parameters<typeof ipcRenderer.on>[1]>[0],
      profileId: string,
    ) => handler(profileId)
    ipcRenderer.on('profiles:activate-from-tray', wrapped)
    return () => ipcRenderer.removeListener('profiles:activate-from-tray', wrapped)
  },

  /**
   * Registers a handler called when an update is available.
   *
   * @param handler - Callback receiving version info.
   * @returns A cleanup function that removes the listener.
   */
  onUpdateAvailable: (handler: (info: { version: string }) => void): (() => void) => {
    const wrapped = (
      _event: Parameters<Parameters<typeof ipcRenderer.on>[1]>[0],
      info: { version: string },
    ) => handler(info)
    ipcRenderer.on('updater:update-available', wrapped)
    return () => ipcRenderer.removeListener('updater:update-available', wrapped)
  },

  /**
   * Registers a handler called when an update has been downloaded and is ready
   * to install.
   *
   * @param handler - Callback receiving version info.
   * @returns A cleanup function that removes the listener.
   */
  onUpdateDownloaded: (handler: (info: { version: string }) => void): (() => void) => {
    const wrapped = (
      _event: Parameters<Parameters<typeof ipcRenderer.on>[1]>[0],
      info: { version: string },
    ) => handler(info)
    ipcRenderer.on('updater:update-downloaded', wrapped)
    return () => ipcRenderer.removeListener('updater:update-downloaded', wrapped)
  },
} as const

// Expose the typed bridge to the renderer process
contextBridge.exposeInMainWorld('api', api)

/** Type of the API object exposed to the renderer via `window.api`. */
export type ElectronApi = typeof api
