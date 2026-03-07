/**
 * @file src/shared/channels.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Typed IPC channel definitions shared between the main and
 * renderer processes. The preload script and IPC handlers both import from
 * this file, ensuring channel names and signatures stay in sync.
 *
 * Channels follow the `{domain}:{action}` naming pattern defined in CLAUDE.md.
 */

import type {
  ClientId,
  ClientStatus,
  McpServer,
  McpServerMap,
  AiRule,
  Profile,
  SyncResult,
  LicenseStatus,
  ValidationResult,
  GitSyncStatus,
  GitPushResult,
  GitPullResult,
  ManualGitConfig,
} from './types'

// ─── Input Types (used in create/update calls) ────────────────────────────────

/**
 * Fields required to create a new MCP server entry.
 */
export interface CreateServerInput {
  readonly name: string
  readonly type: McpServer['type']
  readonly command: string
  /** Endpoint URL — required for `sse` and `http` transport types, unused for `stdio`. */
  readonly url?: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly secretEnvKeys?: readonly string[]
  readonly tags?: readonly string[]
  readonly notes?: string
}

/**
 * Partial update payload for an existing MCP server. Includes all fields from
 * `CreateServerInput` plus the fields that are managed separately after creation
 * (`enabled` and per-client override toggles).
 */
export type UpdateServerInput = Partial<CreateServerInput> & {
  /** Global enable/disable toggle for this server. */
  readonly enabled?: boolean
  /**
   * Per-client toggle overrides. Merges into the existing map — only the
   * provided client keys are changed, all others are left as-is.
   */
  readonly clientOverrides?: Readonly<Record<string, { readonly enabled: boolean }>>
}

/**
 * Fields required to create a new AI rule.
 */
export interface CreateRuleInput {
  readonly name: string
  readonly description?: string
  readonly content: string
  readonly category?: string
  readonly tags?: readonly string[]
  readonly priority?: AiRule['priority']
  readonly scope?: AiRule['scope']
  readonly projectPath?: string
  readonly fileGlobs?: readonly string[]
  readonly alwaysApply?: boolean
}

/**
 * Partial update payload for an existing AI rule. Includes all fields from
 * `CreateRuleInput` plus the fields managed separately after creation
 * (`enabled`, per-client override toggles, and the auto-calculated token
 * estimate stored by the main process on every content save).
 */
export type UpdateRuleInput = Partial<CreateRuleInput> & {
  /** Global enable/disable toggle for this rule. */
  readonly enabled?: boolean
  /**
   * Per-client toggle overrides. Merges into the existing map — only the
   * provided client keys are changed, all others are left as-is.
   */
  readonly clientOverrides?: Readonly<Record<string, { readonly enabled: boolean }>>
  /**
   * Approximate token count calculated by the main process using the
   * word-count heuristic (words * 1.3, rounded up). Set by IPC handlers on
   * every create/update — never sent from the renderer directly.
   */
  readonly tokenEstimate?: number
}

/**
 * Fields required to create a new profile.
 */
export interface CreateProfileInput {
  readonly name: string
  readonly description?: string
  readonly icon?: string
  readonly color?: string
  readonly parentProfileId?: string
}

/**
 * Partial update payload for an existing profile.
 */
export type UpdateProfileInput = Partial<CreateProfileInput> & {
  readonly serverOverrides?: Profile['serverOverrides']
  readonly ruleOverrides?: Profile['ruleOverrides']
}

// ─── Supplementary Types ──────────────────────────────────────────────────────

/**
 * A single entry in the activity log.
 */
export interface ActivityLogEntry {
  readonly id: number
  readonly timestamp: string
  readonly action: string
  readonly details: Readonly<Record<string, unknown>>
  readonly clientId?: ClientId | undefined
  readonly serverId?: string | undefined
}

/**
 * Filters for querying the activity log.
 */
export interface LogFilters {
  readonly action?: string
  readonly clientId?: ClientId
  readonly serverId?: string
  readonly since?: string
  readonly limit?: number
}

/**
 * A backup record for a single client config snapshot.
 */
export interface BackupEntry {
  readonly id: number
  readonly clientId: ClientId
  readonly backupPath: string
  readonly backupType: 'sync' | 'pristine' | 'manual'
  readonly createdAt: string
  readonly fileSize: number
  readonly fileHash: string
}

/**
 * Result of importing servers or rules from an external source.
 */
export interface ImportResult {
  readonly imported: number
  readonly skipped: number
  readonly errors: readonly string[]
}

/**
 * A server entry as it appears in a Smithery/PulseMCP search result.
 */
export interface RegistryServer {
  readonly id: string
  readonly displayName: string
  readonly description: string
  readonly source: 'smithery' | 'pulsemcp' | 'official'
  readonly verified: boolean
  readonly useCount?: number
  readonly remote: boolean
}

/**
 * Result of an MCP server connection test (JSON-RPC initialize handshake).
 */
export interface TestResult {
  readonly success: boolean
  readonly message: string
  readonly responseTimeMs?: number
}

/**
 * A portable bundle of MCP servers and AI rules that can be exported and
 * imported across machines. Secrets are never included in the bundle.
 */
export interface McpStack {
  readonly name: string
  readonly description: string
  readonly version: string
  readonly servers: readonly Omit<McpServer, 'id' | 'secretEnvKeys' | 'clientOverrides'>[]
  readonly rules: readonly Omit<AiRule, 'id' | 'clientOverrides'>[]
  readonly exportedAt: string
}

/**
 * Options for the native open dialog (directory/file picker).
 */
export interface ShowOpenDialogOptions {
  readonly properties?: readonly ('openDirectory' | 'openFile' | 'multiSelections')[]
  readonly title?: string
}

/**
 * Result returned when the user closes the open dialog.
 */
export interface ShowOpenDialogResult {
  readonly canceled: boolean
  readonly filePaths: readonly string[]
}

/**
 * Feature gates that control Pro-tier functionality.
 */
export interface FeatureGates {
  readonly maxServers: number
  readonly maxRules: number
  readonly maxProfiles: number
  readonly gitSync: boolean
  readonly serverTesting: boolean
  readonly registryInstall: boolean
  readonly stackExport: boolean
  readonly tokenBudgetDetailed: boolean
  readonly activityLogDays: number
  readonly ruleTemplates: boolean
}

// ─── IPC Channel Map ──────────────────────────────────────────────────────────

/**
 * Complete map of all typed IPC channels used in aidrelay. Both the preload
 * script and the main-process IPC handlers are typed against this interface.
 */
export interface IpcChannels {
  // Clients
  'clients:detect-all': () => Promise<ClientStatus[]>
  'clients:read-config': (clientId: ClientId) => Promise<McpServerMap>
  'clients:sync': (clientId: ClientId, servers: McpServerMap) => Promise<SyncResult>
  'clients:sync-all': () => Promise<SyncResult[]>

  // Servers
  'servers:list': () => Promise<McpServer[]>
  'servers:get': (id: string) => Promise<McpServer | null>
  'servers:create': (server: CreateServerInput) => Promise<McpServer>
  'servers:update': (id: string, updates: UpdateServerInput) => Promise<McpServer>
  'servers:delete': (id: string) => Promise<void>
  'servers:import-from-clients': () => Promise<ImportResult>

  // Secrets
  'secrets:set': (serverName: string, key: string, value: string) => Promise<void>
  'secrets:get': (serverName: string, key: string) => Promise<string | null>
  'secrets:delete': (serverName: string, key: string) => Promise<void>
  'secrets:list-keys': (serverName: string) => Promise<string[]>
  'secrets:delete-all': (serverName: string) => Promise<void>

  // Backups
  'backups:list': (clientId: ClientId) => Promise<BackupEntry[]>
  'backups:restore': (backupPath: string, clientId: ClientId) => Promise<void>

  // Activity Log
  'log:query': (filters: LogFilters) => Promise<ActivityLogEntry[]>

  // Servers — connection test
  'servers:test': (id: string) => Promise<TestResult>

  // Registry
  'registry:search': (query: string) => Promise<RegistryServer[]>
  'registry:install': (qualifiedName: string) => Promise<McpServer>

  // Stacks
  'stacks:export': (serverIds: string[], ruleIds: string[], name: string) => Promise<string>
  'stacks:import': (json: string) => Promise<ImportResult>

  // Licensing
  'license:activate': (key: string) => Promise<LicenseStatus>
  'license:deactivate': () => Promise<void>
  'license:status': () => Promise<LicenseStatus>
  'license:feature-gates': () => Promise<FeatureGates>

  // Rules
  'rules:list': () => Promise<AiRule[]>
  'rules:get': (id: string) => Promise<AiRule | null>
  'rules:create': (rule: CreateRuleInput) => Promise<AiRule>
  'rules:update': (id: string, updates: UpdateRuleInput) => Promise<AiRule>
  'rules:delete': (id: string) => Promise<void>
  'rules:import-from-project': (dirPath: string) => Promise<ImportResult>
  'rules:sync': (clientId: ClientId) => Promise<SyncResult>
  'rules:sync-all': () => Promise<SyncResult[]>
  'rules:detect-workspaces': () => Promise<string[]>
  'rules:estimate-tokens': (content: string) => Promise<number>

  // Profiles
  'profiles:list': () => Promise<Profile[]>
  'profiles:get': (id: string) => Promise<Profile | null>
  'profiles:create': (profile: CreateProfileInput) => Promise<Profile>
  'profiles:update': (id: string, updates: UpdateProfileInput) => Promise<Profile>
  'profiles:delete': (id: string) => Promise<void>
  'profiles:activate': (id: string) => Promise<SyncResult[]>

  // Validation
  'clients:validate-config': (clientId: ClientId) => Promise<ValidationResult>

  // Git Sync
  'git-sync:status': () => Promise<GitSyncStatus>
  'git-sync:connect-github': () => Promise<GitSyncStatus>
  'git-sync:connect-manual': (config: ManualGitConfig) => Promise<GitSyncStatus>
  'git-sync:disconnect': () => Promise<void>
  'git-sync:push': () => Promise<GitPushResult>
  'git-sync:pull': () => Promise<GitPullResult>

  // Settings
  'settings:get': (key: string) => Promise<unknown>
  'settings:set': (key: string, value: unknown) => Promise<void>
  'settings:delete': (key: string) => Promise<void>

  // Dialog
  'dialog:show-open': (options?: ShowOpenDialogOptions) => Promise<ShowOpenDialogResult>

  // App
  'app:version': () => Promise<string>

  // Auto-updater
  'updater:check': () => Promise<void>
  'updater:install': () => Promise<void>
}
