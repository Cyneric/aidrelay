/**
 * @file src/shared/channels.ts
 *
 * @created 07.03.2026
 * @modified 10.03.2026
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
  ClientInstallFailureReason,
  ClientInstallResult,
  ClientStatus,
  ConfigChangedPayload,
  ConfigImportPreviewResult,
  ConfigImportResult,
  InstallManager,
  McpServer,
  McpServerMap,
  AiRule,
  Profile,
  SyncResult,
  SyncPreviewResult,
  SyncAllPreviewResult,
  LicenseStatus,
  ValidationResult,
  ValidationResultByClientId,
  GitSyncStatus,
  GitPushResult,
  GitPullResult,
  GitRemoteTestResult,
  ManualGitConfig,
  SkillScope,
  SkillLocation,
  InstalledSkill,
  CuratedSkill,
  SkillInstallPreview,
  SkillMigrationPreview,
  SkillSyncConflict,
  SyncClientOptions,
  InstallPlan,
  PreflightReport,
  DeviceSetupState,
  PendingSetup,
  SyncConflict,
  OssAttribution,
} from './types'

// ─── Push-event Payload Types ─────────────────────────────────────────────────

/**
 * Payload sent from the main process whenever the window maximize state changes.
 * Delivered via the `window:maximize-changed` push channel.
 */
export interface WindowMaximizeChangedPayload {
  readonly isMaximized: boolean
}

/**
 * Startup progress payload sent from main to renderer during app bootstrap.
 */
export interface AppStartupProgressPayload {
  readonly progress: number
  readonly message: string
}

/**
 * Startup completion payload sent once initialization has finished.
 */
export interface AppStartupCompletePayload {
  readonly completedAt: number
}

/**
 * Snapshot of current startup state, queried by renderer to recover from any
 * missed early startup events.
 */
export interface AppStartupStatus {
  readonly progress: number
  readonly message: string
  readonly ready: boolean
  readonly startedAt: number
  readonly completedAt?: number
}

/**
 * Install progress payload pushed during a `clients:install` execution.
 * The renderer uses this to render deterministic, step-based install UX.
 */
export interface ClientInstallProgressPayload {
  readonly clientId: ClientId
  readonly phase:
    | 'start'
    | 'manager_check'
    | 'manager_running'
    | 'manager_skipped'
    | 'manager_failed'
    | 'manager_succeeded'
    | 'completed'
  readonly progress: number
  readonly attemptIndex: number
  readonly attemptCount: number
  readonly manager?: InstallManager
  readonly failureReason?: ClientInstallFailureReason
}

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
  readonly headers?: Readonly<Record<string, string>>
  readonly secretHeaderKeys?: readonly string[]
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

/**
 * Input payload for creating a new skill scaffold.
 */
export interface CreateSkillInput {
  readonly name: string
  readonly scope: SkillScope
  readonly projectPath?: string
  readonly description?: string
  readonly resources?: readonly ('scripts' | 'references' | 'assets')[]
}

/**
 * Input payload for installing a curated skill.
 */
export interface InstallCuratedSkillInput {
  readonly skillName: string
  readonly scope: SkillScope
  readonly projectPath?: string
  readonly replace?: boolean
}

/**
 * Input payload for deleting a skill.
 */
export interface DeleteSkillInput {
  readonly scope: SkillScope
  readonly skillName: string
  readonly projectPath?: string
}

/**
 * Input payload for toggling skill enablement (Codex `disable_skills`).
 */
export interface SetSkillEnabledInput {
  readonly scope: SkillScope
  readonly skillName: string
  readonly enabled: boolean
  readonly projectPath?: string
}

/**
 * Input payload for applying legacy skill migrations.
 */
export interface ApplySkillMigrationInput {
  readonly items: readonly SkillLocation[]
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
 * Filters for querying backup history entries.
 */
export interface BackupQueryFilters {
  readonly clientId?: ClientId
  readonly search?: string
  readonly types?: readonly BackupEntry['backupType'][]
  readonly from?: string
  readonly to?: string
  readonly sort?: 'newest' | 'oldest'
  readonly limit?: number
  readonly offset?: number
}

/**
 * Paged backup query result.
 */
export interface BackupQueryResult {
  readonly items: readonly BackupEntry[]
  readonly total: number
}

/**
 * One changed field previewed before a restore operation.
 */
export interface RestorePreviewBlock {
  readonly path: string
  readonly kind: 'added' | 'removed' | 'changed'
  readonly before: string | null
  readonly after: string | null
}

/**
 * Restore preview summary used by the renderer to show impact before confirm.
 */
export interface RestorePreviewResult {
  readonly clientId: ClientId
  readonly backupPath: string
  readonly liveConfigPath: string
  readonly hasLiveConfig: boolean
  readonly mode: 'json' | 'text'
  readonly added: number
  readonly removed: number
  readonly changed: number
  readonly totalChanges: number
  readonly blocks: readonly RestorePreviewBlock[]
  readonly truncated: boolean
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
 * Supported registry search providers.
 */
export type RegistryProvider = 'smithery' | 'official'

/**
 * One input field required (or optionally available) to resolve a registry
 * install option into a final server config.
 */
export interface RegistryInstallInputField {
  readonly key: string
  readonly label: string
  readonly description?: string
  readonly required: boolean
  readonly secret: boolean
  readonly defaultValue?: string
  readonly placeholder?: string
  readonly target: 'arg' | 'env' | 'url' | 'header'
}

/**
 * One concrete install option produced by registry metadata resolution.
 * A server can expose multiple options (for example stdio package vs hosted
 * remote endpoint), and the user must pick one before install.
 */
export interface RegistryInstallOption {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly type: McpServer['type']
  readonly command: string
  readonly args: readonly string[]
  readonly url?: string
  readonly env?: Readonly<Record<string, string>>
  readonly headers?: Readonly<Record<string, string>>
  readonly inputFields: readonly RegistryInstallInputField[]
}

/**
 * Prepared install plan returned by the main process for a registry entry.
 * The renderer uses this plan to render the wizard and final review step.
 */
export interface RegistryInstallPlan {
  readonly provider: RegistryProvider
  readonly serverId: string
  readonly displayName: string
  readonly description: string
  readonly options: readonly RegistryInstallOption[]
  readonly defaultOptionId?: string
}

/**
 * Install request sent after the user completes option selection, variable
 * input, and final review in the add-server wizard.
 */
export interface RegistryInstallRequest {
  readonly provider: RegistryProvider
  readonly serverId: string
  readonly optionId: string
  readonly inputs?: Readonly<Record<string, string>>
  readonly serverName?: string
  readonly confirmed: boolean
}

/**
 * Result of an MCP server connection test (JSON-RPC initialize handshake).
 */
export interface TestResult {
  readonly success: boolean
  readonly message: string
  readonly details?: string
  readonly hint?: string
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
  readonly servers: readonly Omit<
    McpServer,
    'id' | 'secretEnvKeys' | 'secretHeaderKeys' | 'clientOverrides'
  >[]
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

/**
 * Input payload for resetting selected application setting categories.
 */
export interface SettingsResetInput {
  readonly scope: 'partial' | 'factory'
  readonly uiPreferences: boolean
  readonly gitRemoteForm: boolean
  readonly gitSyncConnection: boolean
}

/**
 * Result returned after a settings reset operation.
 */
export interface SettingsResetResult {
  readonly resetKeys: readonly string[]
  readonly disconnectedGitSync: boolean
  readonly clearedAllSecrets: boolean
  readonly clearedLicenseCache: boolean
  readonly databaseReset: boolean
  readonly deletedPaths: readonly string[]
  readonly restartTriggered: boolean
}

/**
 * UTF-8 text file payload returned by `files:read-text`.
 */
export interface ReadTextFileResult {
  readonly content: string
  readonly mtimeMs: number
  readonly size: number
  readonly encoding: 'utf-8'
}

/**
 * Result returned after writing a UTF-8 text file.
 */
export interface WriteTextFileResult {
  readonly mtimeMs: number
}

// ─── IPC Channel Map ──────────────────────────────────────────────────────────

/**
 * Complete map of all typed IPC channels used in aidrelay. Both the preload
 * script and the main-process IPC handlers are typed against this interface.
 */
export interface IpcChannels {
  // Clients
  'clients:detect-all': () => Promise<ClientStatus[]>
  'clients:install': (clientId: ClientId) => Promise<ClientInstallResult>
  'clients:read-config': (clientId: ClientId) => Promise<McpServerMap>
  'clients:sync': (clientId: ClientId, options?: SyncClientOptions) => Promise<SyncResult>
  'clients:sync-all': () => Promise<SyncResult[]>
  'clients:preview-sync': (
    clientId: ClientId,
    options?: SyncClientOptions,
  ) => Promise<SyncPreviewResult>
  'clients:preview-sync-all': () => Promise<SyncAllPreviewResult>
  'clients:preview-config-import': (
    payload: ConfigChangedPayload,
  ) => Promise<ConfigImportPreviewResult>
  'clients:import-config-changes': (payload: ConfigChangedPayload) => Promise<ConfigImportResult>
  'clients:set-manual-config-path': (
    clientId: ClientId,
    configPath: string,
  ) => Promise<ValidationResult>
  'clients:clear-manual-config-path': (clientId: ClientId) => Promise<void>

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
  'backups:query': (filters: BackupQueryFilters) => Promise<BackupQueryResult>
  'backups:preview-restore': (
    backupPath: string,
    clientId: ClientId,
  ) => Promise<RestorePreviewResult>
  'backups:restore': (backupPath: string, clientId: ClientId) => Promise<void>

  // Activity Log
  'log:query': (filters: LogFilters) => Promise<ActivityLogEntry[]>

  // Servers — connection test
  'servers:test': (id: string) => Promise<TestResult>

  // Registry
  'registry:search': (provider: RegistryProvider, query: string) => Promise<RegistryServer[]>
  'registry:prepare-install': (
    provider: RegistryProvider,
    serverId: string,
  ) => Promise<RegistryInstallPlan>
  'registry:install': (request: RegistryInstallRequest) => Promise<McpServer>

  // Installer
  'installer:prepare': (serverId: string) => Promise<InstallPlan>
  'installer:preflight': (serverId: string) => Promise<PreflightReport>
  'installer:run': (serverId: string) => Promise<void>
  'installer:cancel': (serverId: string) => Promise<void>
  'installer:status': (serverId: string) => Promise<DeviceSetupState | null>
  'installer:repair': (serverId: string) => Promise<InstallPlan>

  // Sync (assisted cross‑device)
  'sync:list-pending': () => Promise<PendingSetup[]>
  'sync:apply-pending': (serverId: string) => Promise<void>
  'sync:auto-pull': () => Promise<void>
  'sync:resolve-conflict': (conflictId: string, resolution: 'local' | 'remote') => Promise<void>
  'sync:push-review': () => Promise<SyncConflict[]>

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

  // Skills
  'skills:list-installed': () => Promise<InstalledSkill[]>
  'skills:list-curated': () => Promise<CuratedSkill[]>
  'skills:detect-workspaces': () => Promise<string[]>
  'skills:prepare-install': (
    skillName: string,
    scope: SkillScope,
    projectPath?: string,
  ) => Promise<SkillInstallPreview>
  'skills:install-curated': (input: InstallCuratedSkillInput) => Promise<InstalledSkill>
  'skills:create': (input: CreateSkillInput) => Promise<InstalledSkill>
  'skills:delete': (input: DeleteSkillInput) => Promise<void>
  'skills:set-enabled': (input: SetSkillEnabledInput) => Promise<void>
  'skills:migrate-legacy-preview': () => Promise<SkillMigrationPreview>
  'skills:migrate-legacy-apply': (input: ApplySkillMigrationInput) => Promise<SkillMigrationPreview>
  'skills:sync:list-conflicts': () => Promise<SkillSyncConflict[]>
  'skills:sync:resolve-conflict': (
    conflictId: string,
    resolution: 'local' | 'remote',
  ) => Promise<void>

  // Profiles
  'profiles:list': () => Promise<Profile[]>
  'profiles:get': (id: string) => Promise<Profile | null>
  'profiles:create': (profile: CreateProfileInput) => Promise<Profile>
  'profiles:update': (id: string, updates: UpdateProfileInput) => Promise<Profile>
  'profiles:delete': (id: string) => Promise<void>
  'profiles:activate': (id: string) => Promise<SyncResult[]>

  // Validation
  'clients:validate-config': (clientId: ClientId) => Promise<ValidationResult>
  'clients:validate-all-configs': () => Promise<ValidationResultByClientId>

  // Git Sync
  'git-sync:status': () => Promise<GitSyncStatus>
  'git-sync:connect-github': () => Promise<GitSyncStatus>
  'git-sync:connect-manual': (config: ManualGitConfig) => Promise<GitSyncStatus>
  'git-sync:test-remote': (config: ManualGitConfig) => Promise<GitRemoteTestResult>
  'git-sync:disconnect': () => Promise<void>
  'git-sync:push': () => Promise<GitPushResult>
  'git-sync:pull': () => Promise<GitPullResult>

  // Settings
  'settings:get': (key: string) => Promise<unknown>
  'settings:set': (key: string, value: unknown) => Promise<void>
  'settings:delete': (key: string) => Promise<void>
  'settings:reset': (input: SettingsResetInput) => Promise<SettingsResetResult>

  // Dialog
  'dialog:show-open': (options?: ShowOpenDialogOptions) => Promise<ShowOpenDialogResult>

  // Files
  'files:reveal': (path: string) => Promise<void>
  'files:read-text': (path: string) => Promise<ReadTextFileResult>
  'files:write-text': (
    path: string,
    content: string,
    expectedMtimeMs: number,
  ) => Promise<WriteTextFileResult>

  // App
  'app:version': () => Promise<string>
  'app:startup-status': () => Promise<AppStartupStatus>
  'app:oss-attributions': () => Promise<OssAttribution[]>

  // Auto-updater
  'updater:check': () => Promise<void>
  'updater:install': () => Promise<void>
}
