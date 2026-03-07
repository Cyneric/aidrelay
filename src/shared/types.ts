/**
 * @file src/shared/types.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
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
