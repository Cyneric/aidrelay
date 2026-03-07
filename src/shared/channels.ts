/**
 * @file src/shared/channels.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Typed IPC channel definitions shared between the main and
 * renderer processes. The preload script and IPC handlers both import from
 * this file, ensuring channel names and signatures stay in sync.
 *
 * Channels follow the `{domain}:{action}` naming pattern defined in CLAUDE.md.
 * This file is a stub — channels are populated as each domain is implemented.
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
} from './types'

// ─── Input Types (used in create/update calls) ────────────────────────────────

/**
 * Fields required to create a new MCP server entry.
 */
export interface CreateServerInput {
  readonly name: string
  readonly type: McpServer['type']
  readonly command: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly secretEnvKeys?: readonly string[]
  readonly tags?: readonly string[]
  readonly notes?: string
}

/**
 * Partial update payload for an existing MCP server.
 */
export type UpdateServerInput = Partial<Omit<CreateServerInput, 'name'>> & {
  readonly name?: string
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
 * Partial update payload for an existing AI rule.
 */
export type UpdateRuleInput = Partial<CreateRuleInput>

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
 *
 * Channels are stubs now — the function bodies are added as each domain
 * is implemented in subsequent phases.
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

  // Secrets
  'secrets:set': (serverName: string, key: string, value: string) => Promise<void>
  'secrets:get': (serverName: string, key: string) => Promise<string | null>
  'secrets:delete': (serverName: string, key: string) => Promise<void>

  // Backups
  'backups:list': (clientId: ClientId) => Promise<BackupEntry[]>
  'backups:restore': (backupPath: string, clientId: ClientId) => Promise<void>

  // Activity Log
  'log:query': (filters: LogFilters) => Promise<ActivityLogEntry[]>

  // Registry search
  'registry:search': (query: string) => Promise<RegistryServer[]>

  // Licensing
  'license:validate': (key: string) => Promise<LicenseStatus>
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
}
