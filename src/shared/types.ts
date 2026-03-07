/**
 * @file src/shared/types.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Core domain types shared between the main and renderer
 * processes. Both processes import from this file — never from each other.
 * All types here are plain data structures (no Electron-specific imports).
 */

// ─── Client Types ────────────────────────────────────────────────────────────

/**
 * Identifiers for all supported AI development tool clients.
 * Windows paths are implemented first; macOS/Linux paths added later.
 */
export type ClientId =
  | 'claude-desktop'
  | 'claude-code'
  | 'cursor'
  | 'vscode'
  | 'windsurf'
  | 'zed'
  | 'jetbrains'
  | 'codex-cli'

/**
 * Result returned from a client adapter's `detect()` call.
 */
export interface ClientDetectionResult {
  readonly installed: boolean
  readonly configPaths: readonly string[]
  readonly version?: string
  readonly serverCount: number
}

/**
 * Runtime status of a detected client, used in the UI.
 */
export interface ClientStatus {
  readonly id: ClientId
  readonly displayName: string
  readonly installed: boolean
  readonly configPaths: readonly string[]
  readonly serverCount: number
  readonly lastSyncedAt?: string
  readonly syncStatus: 'synced' | 'out-of-sync' | 'never-synced' | 'error'
}

// ─── MCP Server Types ─────────────────────────────────────────────────────────

/**
 * Transport type for an MCP server connection.
 */
export type McpServerType = 'stdio' | 'sse' | 'http'

/**
 * A raw MCP server entry as it appears in a client config file.
 * This is the minimal shape each client adapter reads and writes.
 */
export interface McpServerConfig {
  readonly command: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly type?: McpServerType
  readonly url?: string
}

/**
 * A map of server name → server config, matching the `mcpServers`
 * shape used by Claude Desktop, Cursor, Windsurf, and Claude Code.
 */
export type McpServerMap = Readonly<Record<string, McpServerConfig>>

/**
 * A fully-hydrated MCP server entry as stored in aidrelay's registry.
 * Extends the raw config with metadata and per-client overrides.
 */
export interface McpServer {
  readonly id: string
  readonly name: string
  readonly type: McpServerType
  /** Endpoint URL — populated for `sse` and `http` transport types. */
  readonly url?: string
  readonly command: string
  readonly args: readonly string[]
  readonly env: Readonly<Record<string, string>>
  readonly secretEnvKeys: readonly string[]
  readonly enabled: boolean
  readonly clientOverrides: Readonly<Record<ClientId, { readonly enabled: boolean }>>
  readonly tags: readonly string[]
  readonly notes: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ─── AI Rules Types ───────────────────────────────────────────────────────────

/**
 * Priority level for an AI rule, affecting sort order and display.
 */
export type RulePriority = 'critical' | 'high' | 'normal' | 'low'

/**
 * Whether a rule applies to all projects globally or to a specific
 * workspace directory.
 */
export type RuleScope = 'global' | 'project'

/**
 * A single AI coding rule stored in the aidrelay registry.
 */
export interface AiRule {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly content: string
  readonly category: string
  readonly tags: readonly string[]
  readonly enabled: boolean
  readonly priority: RulePriority
  readonly scope: RuleScope
  readonly projectPath?: string
  readonly fileGlobs: readonly string[]
  readonly alwaysApply: boolean
  readonly clientOverrides: Readonly<Record<ClientId, { readonly enabled: boolean }>>
  readonly tokenEstimate: number
  readonly createdAt: string
  readonly updatedAt: string
}

// ─── Profile Types ────────────────────────────────────────────────────────────

/**
 * A named configuration profile that bundles a specific set of server
 * and rule overrides for quick context switching.
 */
export interface Profile {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly color: string
  readonly isActive: boolean
  readonly parentProfileId?: string
  readonly serverOverrides: Readonly<
    Record<
      string,
      {
        readonly enabled: boolean
        readonly clientOverrides?: Readonly<Record<ClientId, { readonly enabled: boolean }>>
      }
    >
  >
  readonly ruleOverrides: Readonly<
    Record<
      string,
      {
        readonly enabled: boolean
        readonly clientOverrides?: Readonly<Record<ClientId, { readonly enabled: boolean }>>
      }
    >
  >
  readonly createdAt: string
  readonly updatedAt: string
}

// ─── Licensing Types ──────────────────────────────────────────────────────────

/**
 * Subscription tier for the application.
 * Free is genuinely useful; Pro unlocks advanced features.
 */
export type PlanTier = 'free' | 'pro'

/**
 * Current license status cached from the last license-provider validation.
 */
export interface LicenseStatus {
  readonly tier: PlanTier
  readonly valid: boolean
  readonly expiresAt?: string
  readonly lastValidatedAt: string
}

// ─── File Watcher Types ───────────────────────────────────────────────────────

/**
 * Payload sent to the renderer when a watched client config changes externally.
 * Delivered via the `clients:config-changed` IPC event (not a `handle` channel).
 */
export interface ConfigChangedPayload {
  readonly clientId: ClientId
  readonly configPath: string
  readonly added: readonly string[]
  readonly removed: readonly string[]
  readonly modified: readonly string[]
}

// ─── Git Sync Types ───────────────────────────────────────────────────────────

/**
 * Supported Git providers for cloud sync.
 */
export type GitSyncProvider = 'github' | 'generic'

/**
 * Persisted configuration for the git-based cloud sync feature.
 * Stored as a JSON value in the settings repository under `git-sync:config`.
 * The auth token is stored separately in keytar, never here.
 */
export interface GitSyncConfig {
  readonly provider: GitSyncProvider
  readonly remoteUrl: string
  readonly branch: string
  readonly lastPushAt?: string
  readonly lastPullAt?: string
}

/**
 * Runtime status of the git sync connection, returned to the renderer.
 */
export interface GitSyncStatus {
  readonly connected: boolean
  readonly config?: GitSyncConfig
}

/**
 * Result of a git push operation.
 */
export interface GitPushResult {
  readonly success: boolean
  readonly commitHash?: string
  readonly error?: string
}

/**
 * Result of a git pull and registry import operation.
 */
export interface GitPullResult {
  readonly success: boolean
  readonly serversImported: number
  readonly rulesImported: number
  readonly profilesImported: number
  /** Count of local entries overwritten by the remote (last-write-wins). */
  readonly conflicts: number
  readonly error?: string
}

/**
 * Input for manually configuring a git remote (any HTTPS provider).
 */
export interface ManualGitConfig {
  readonly remoteUrl: string
  readonly branch?: string
  readonly authToken: string
}

// ─── Sync / Result Types ──────────────────────────────────────────────────────

/**
 * Result of a sync operation to a single client.
 */
export interface SyncResult {
  readonly clientId: ClientId
  readonly success: boolean
  readonly serversWritten: number
  readonly error?: string
  readonly syncedAt: string
}

/**
 * Result of a config validation step.
 */
export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}
