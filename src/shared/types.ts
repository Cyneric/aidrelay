/**
 * @file src/shared/types.ts
 *
 * @created 07.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
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
  | 'cline'
  | 'roo-code'
  | 'cursor'
  | 'vscode'
  | 'vscode-insiders'
  | 'windsurf'
  | 'zed'
  | 'jetbrains'
  | 'gemini-cli'
  | 'kilo-cli'
  | 'codex-cli'
  | 'codex-gui'
  | 'opencode'
  | 'visual-studio'

/**
 * Supported package managers used by the in-app client installer.
 */
export type InstallManager = 'winget' | 'choco' | 'npm' | 'manual'

/**
 * Failure reason returned by the in-app client installer.
 */
export type ClientInstallFailureReason =
  | 'unsupported_platform'
  | 'unsupported_client'
  | 'no_available_manager'
  | 'command_failed'
  | 'requires_elevation'
  | 'manual_install_required'

/**
 * Single install attempt record for one package manager command.
 */
export interface ClientInstallAttempt {
  readonly manager: InstallManager
  readonly command: string
  readonly args: readonly string[]
  readonly success: boolean
  readonly skipped?: boolean
  readonly exitCode?: number
  readonly stdout?: string
  readonly stderr?: string
  readonly error?: string
}

/**
 * Result returned by `clients:install` with full fallback attempt history.
 */
export interface ClientInstallResult {
  readonly clientId: ClientId
  readonly success: boolean
  readonly attempts: readonly ClientInstallAttempt[]
  readonly installedWith?: InstallManager
  readonly failureReason?: ClientInstallFailureReason
  readonly docsUrl?: string
  readonly message: string
}

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
 * Persisted validation outcome for a client config file.
 */
export interface StoredValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly validatedAt: string
}

/**
 * Runtime status of a detected client, used in the UI.
 */
export interface ClientStatus {
  readonly id: ClientId
  readonly displayName: string
  readonly installed: boolean
  readonly configPaths: readonly string[]
  readonly manualConfigPath?: string
  readonly serverCount: number
  readonly lastSyncedAt?: string
  readonly syncStatus: 'synced' | 'out-of-sync' | 'never-synced' | 'error'
  readonly lastValidation?: StoredValidationResult
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
  readonly headers?: Readonly<Record<string, string>>
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
  readonly headers: Readonly<Record<string, string>>
  readonly secretHeaderKeys: readonly string[]
  readonly enabled: boolean
  readonly clientOverrides: Readonly<Record<ClientId, { readonly enabled: boolean }>>
  readonly tags: readonly string[]
  readonly notes: string
  readonly createdAt: string
  readonly updatedAt: string
  /** Install metadata for local servers */
  readonly recipeId: string
  readonly recipeVersion: string
  readonly setupStatus:
    | 'ready'
    | 'needs_setup'
    | 'missing_secrets'
    | 'install_failed'
    | 'outdated_recipe'
  readonly lastInstallResult: Readonly<Record<string, unknown>>
  readonly lastInstallTimestamp: string
  readonly installPolicy: 'auto' | 'manual' | 'disabled'
  readonly normalizedLaunchConfig: Readonly<Record<string, unknown>>
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

/**
 * Action classification for one server entry when previewing an external
 * config import into the local aidrelay registry.
 */
export type ConfigImportPreviewAction = 'create' | 'overwrite' | 'no-op' | 'removed_external'

/**
 * Diff preview row for one server name.
 * `before` is the current aidrelay registry projection; `after` is the
 * currently detected external config projection.
 */
export interface ConfigImportPreviewItem {
  readonly name: string
  readonly source: 'added' | 'removed' | 'modified'
  readonly action: ConfigImportPreviewAction
  readonly before: McpServerConfig | null
  readonly after: McpServerConfig | null
}

/**
 * Preview payload returned before importing an externally changed client config.
 */
export interface ConfigImportPreviewResult {
  readonly clientId: ClientId
  readonly configPath: string
  readonly items: readonly ConfigImportPreviewItem[]
}

/**
 * Result of importing externally changed client config entries into aidrelay.
 */
export interface ConfigImportResult {
  readonly clientId: ClientId
  readonly configPath: string
  readonly created: number
  readonly updated: number
  readonly skipped: number
  readonly errors: readonly string[]
}
// ─── Sync Preview Types ───────────────────────────────────────────────────────

/**
 * Extended action set for sync preview (includes preserved unmanaged servers).
 */
export type SyncPreviewAction = 'create' | 'overwrite' | 'no-op' | 'preserved_unmanaged' | 'removed'

/**
 * Diff preview row for one server name during sync.
 * `before` is the current client config; `after` is the merged config that will be written.
 */
export interface SyncPreviewItem {
  readonly name: string
  readonly source: 'added' | 'removed' | 'modified'
  readonly action: SyncPreviewAction
  readonly before: McpServerConfig | null
  readonly after: McpServerConfig | null
}

/**
 * Preview payload returned before syncing a client config.
 */
export interface SyncPreviewResult {
  readonly clientId: ClientId
  readonly configPath: string
  readonly items: readonly SyncPreviewItem[]
}

/**
 * Multi‑client preview payload for "Sync All".
 */
export interface SyncAllPreviewResult {
  readonly previews: Readonly<Partial<Record<ClientId, SyncPreviewResult>>>
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
  readonly errorCode?: SyncErrorCode
  readonly syncedAt: string
}

/**
 * Machine-readable sync error code for renderer-side branching.
 */
export type SyncErrorCode = 'config_creation_required'

/**
 * Optional behavior toggles for single-client sync.
 */
export interface SyncClientOptions {
  readonly allowCreateConfigIfMissing?: boolean
}

/**
 * Result of a config validation step.
 */
export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

/**
 * Map of clientId -> persisted validation result.
 */
export type ValidationResultByClientId = Partial<Record<ClientId, StoredValidationResult>>

// ─── Local Installation Types ──────────────────────────────────────────────────

/**
 * Setup status for a server on a specific device.
 */
export type SetupStatus =
  | 'ready'
  | 'needs_setup'
  | 'missing_secrets'
  | 'install_failed'
  | 'outdated_recipe'

/**
 * Install policy for a server.
 */
export type InstallPolicy = 'auto' | 'manual' | 'disabled'

/**
 * Runtime detection configuration for checking prerequisites.
 */
export interface RuntimeDetectionConfig {
  readonly type: 'command' | 'path' | 'registry' | 'process'
  readonly check: string
  readonly hint: string
  readonly installHint?: string
}

/**
 * Preflight check result.
 */
export interface PreflightResult {
  readonly id: string
  readonly description: string
  readonly success: boolean
  readonly message: string
  readonly hint?: string
}

/**
 * Install adapter type for package managers.
 */
export type InstallAdapterType = 'winget' | 'npm' | 'pip' | 'cargo' | 'docker' | 'executable'

/**
 * Device-specific setup state (never synced).
 */
export interface DeviceSetupState {
  readonly deviceId: string
  readonly serverId: string
  readonly runtimeDetectionResults: Readonly<Record<string, boolean>>
  readonly logs: readonly LogEntry[]
  readonly installStatus: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back'
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Log entry for installation progress.
 */
export interface LogEntry {
  readonly timestamp: string
  readonly level: 'info' | 'warn' | 'error' | 'debug'
  readonly message: string
  readonly details?: unknown
}

/**
 * Synced install intent metadata (synced across devices).
 */
export interface SyncedInstallIntent {
  readonly serverId: string
  readonly recipeId: string
  readonly recipeVersion: string
  readonly installPolicy: InstallPolicy
  readonly normalizedLaunchConfig: Readonly<Record<string, unknown>>
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Install progress payload for push events.
 */
export interface InstallProgressPayload {
  readonly serverId: string
  readonly step: string
  readonly progress: number
  readonly totalSteps: number
  readonly message: string
  readonly details?: string
}

/**
 * Pending setup item after sync.
 */
export interface PendingSetup {
  readonly serverId: string
  readonly serverName: string
  readonly reason:
    | 'missing_secrets'
    | 'missing_runtime'
    | 'install_required'
    | 'verification_failed'
  readonly actions: readonly string[]
}

/**
 * Conflict resolution for sync.
 */
export interface SyncConflict {
  readonly id: string
  readonly serverId: string
  readonly serverName: string
  readonly field: string
  readonly localValue: unknown
  readonly remoteValue: unknown
  readonly resolved?: boolean
}

/**
 * Install recipe for local MCP servers.
 * Combines runtime detection, package manager installation, and launch config.
 */
export interface InstallRecipe {
  readonly id: string
  readonly version: string
  readonly displayName: string
  readonly description?: string
  readonly runtimeDetection: readonly RuntimeDetectionConfig[]
  readonly adapters: readonly InstallAdapterConfig[]
  readonly preflight?: readonly PreflightCheck[]
  readonly launchConfig: LaunchConfig
}

/**
 * Single install adapter configuration (e.g., winget, npm, pip, cargo).
 */
export interface InstallAdapterConfig {
  readonly type: InstallAdapterType
  readonly package: string
  readonly version?: string
  readonly command?: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly priority: number
}

/**
 * Preflight check definition.
 */
export interface PreflightCheck {
  readonly id: string
  readonly description: string
  readonly check: 'runtime' | 'path' | 'command' | 'registry' | 'process'
  readonly target: string
  readonly hint: string
  readonly installHint?: string
}

/**
 * Launch configuration after installation.
 */
export interface LaunchConfig {
  readonly command: string
  readonly args: readonly string[]
  readonly env: Readonly<Record<string, string>>
  readonly type: McpServerType
  readonly url?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly secretEnvKeys?: readonly string[]
  readonly secretHeaderKeys?: readonly string[]
}

/**
 * Preflight report with results of all checks.
 */
export interface PreflightReport {
  readonly serverId: string
  readonly recipeId: string
  readonly recipeVersion: string
  readonly checks: readonly PreflightResult[]
  readonly success: boolean
  readonly missingRuntimes: readonly RuntimeDetectionConfig[]
  readonly suggestions: readonly string[]
}

/**
 * Install plan generated from a recipe and user choices.
 */
export interface InstallPlan {
  readonly serverId: string
  readonly recipeId: string
  readonly recipeVersion: string
  readonly steps: readonly InstallStep[]
  readonly estimatedDuration: number
  readonly requiresElevation: boolean
  readonly rollbackSteps?: readonly InstallStep[]
}

/**
 * Single step in an installation plan.
 */
export interface InstallStep {
  readonly id: string
  readonly description: string
  readonly action: 'detect' | 'install' | 'configure' | 'verify' | 'rollback'
  readonly adapterType?: InstallAdapterType
  readonly command?: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
}
