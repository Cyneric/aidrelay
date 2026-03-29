import { existsSync } from 'fs'
import type {
  AiRule,
  ClientId,
  McpServer,
  SyncClientOptions,
  SyncPlanBlocker,
  SyncPlanFileAction,
  SyncPlanFileEntry,
  SyncPlanOrigin,
  SyncPlanProfileOverrideItem,
  SyncPlanResult,
  SyncPlanScope,
  SyncPreviewItem,
} from '@shared/types'
import { ADAPTERS, ADAPTER_IDS } from '@main/clients/registry'
import {
  resolveClientDetection,
  resolveConfigPathForSync,
  getStoredManualConfigPath,
} from '@main/ipc/clients.ipc'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { BackupsRepo } from '@main/db/backups.repo'
import { BackupService } from '@main/sync/backup.service'
import { SyncService } from '@main/sync/sync.service'
import { RulesSyncService } from '@main/rules/rules-sync.service'
import { ProfilesRepo } from '@main/db/profiles.repo'
import { RulesRepo } from '@main/db/rules.repo'

const MEANINGFUL_MCP_ACTIONS = new Set<SyncPreviewItem['action']>([
  'create',
  'overwrite',
  'removed',
])

const compareEntries = (a: SyncPlanFileEntry, b: SyncPlanFileEntry): number => {
  const clientCompare = (a.clientName ?? '').localeCompare(b.clientName ?? '')
  if (clientCompare !== 0) return clientCompare
  const featureCompare = a.feature.localeCompare(b.feature)
  if (featureCompare !== 0) return featureCompare
  return a.path.localeCompare(b.path)
}

const createSyncService = (): SyncService => {
  const db = getDatabase()
  return new SyncService(
    new ServersRepo(db),
    new ActivityLogRepo(db),
    new BackupService(new BackupsRepo(db)),
  )
}

class SyncPlanService {
  async preview(scope: SyncPlanScope): Promise<SyncPlanResult> {
    switch (scope.kind) {
      case 'app':
        return this.previewCurrentState(scope)
      case 'client':
        return this.previewSingleClient(scope)
      case 'actionable-clients':
        return this.previewClientSet(scope)
      case 'rules-all':
        return this.previewRules(scope)
      case 'profile-activate':
        return this.previewProfileActivation(scope)
    }
  }

  private async previewCurrentState(
    scope: SyncPlanScope & { kind: 'app' },
  ): Promise<SyncPlanResult> {
    const installedIds = await this.getInstalledClientIds()
    const clientScope: SyncPlanScope = {
      kind: 'actionable-clients',
      clientIds: installedIds,
      allowCreateConfigIfMissing: true,
    }
    const clientResult = await this.previewClientSet(clientScope)
    const rulesResult = await this.previewRules({ kind: 'rules-all' })

    return this.buildResult(
      scope,
      [...clientResult.entries, ...rulesResult.entries],
      [...clientResult.blockers, ...rulesResult.blockers],
    )
  }

  private async previewSingleClient(
    scope: SyncPlanScope & { kind: 'client' },
    serversOverride?: readonly McpServer[],
  ): Promise<SyncPlanResult> {
    const { entries, blockers } = await this.previewClientEntries(
      scope.clientId,
      scope.options,
      scope.options?.allowCreateConfigIfMissing ?? false,
      serversOverride,
      scope.kind === 'client' ? 'client-sync' : 'profile-activation',
    )
    return this.buildResult(scope, entries, blockers)
  }

  private async previewClientSet(
    scope: SyncPlanScope & { kind: 'actionable-clients' },
    serversOverride?: readonly McpServer[],
    origin: SyncPlanOrigin = 'client-sync',
  ): Promise<SyncPlanResult> {
    const results = await Promise.all(
      scope.clientIds.map((clientId) =>
        this.previewClientEntries(
          clientId,
          undefined,
          scope.allowCreateConfigIfMissing ?? true,
          serversOverride,
          origin,
        ),
      ),
    )

    return this.buildResult(
      scope,
      results.flatMap((result) => result.entries),
      results.flatMap((result) => result.blockers),
    )
  }

  private async previewRules(
    scope: SyncPlanScope & { kind: 'rules-all' },
    rulesOverride?: readonly AiRule[],
    origin: SyncPlanOrigin = 'rules-sync',
  ): Promise<SyncPlanResult> {
    const installedIds = await this.getInstalledClientIds()
    const rulesService = new RulesSyncService(getDatabase())
    const previews = rulesService.previewAll(installedIds, rulesOverride)
    const entries: SyncPlanFileEntry[] = []

    for (const clientId of installedIds) {
      const adapter = ADAPTERS.get(clientId)
      if (!adapter) continue

      for (const preview of previews[clientId] ?? []) {
        entries.push({
          id: `rules:${clientId}:${preview.path}`,
          path: preview.path,
          feature: 'rules',
          origin,
          action: preview.action,
          clientId,
          clientName: adapter.displayName,
          detail: {
            kind: 'rules',
            before: preview.before,
            after: preview.after,
            ruleCount: preview.ruleCount,
          },
        })
      }
    }

    return this.buildResult(scope, entries, [])
  }

  private async previewProfileActivation(
    scope: SyncPlanScope & { kind: 'profile-activate' },
  ): Promise<SyncPlanResult> {
    const db = getDatabase()
    const profilesRepo = new ProfilesRepo(db)
    const serversRepo = new ServersRepo(db)
    const rulesRepo = new RulesRepo(db)
    const profile = profilesRepo.findById(scope.profileId)

    if (!profile) {
      return this.buildResult(
        scope,
        [],
        [
          {
            id: `profile-missing:${scope.profileId}`,
            title: 'Profile not found',
            description: `Profile "${scope.profileId}" no longer exists.`,
          },
        ],
      )
    }

    const currentServers = serversRepo.findAll()
    const currentRules = rulesRepo.findAll()
    const nextServers = this.applyServerOverrides(currentServers, profile.serverOverrides)
    const nextRules = this.applyRuleOverrides(currentRules, profile.ruleOverrides)
    const clientIds = await this.getInstalledClientIds()

    const clientResult = await this.previewClientSet(
      {
        kind: 'actionable-clients',
        clientIds,
        allowCreateConfigIfMissing: false,
      },
      nextServers,
      'profile-activation',
    )
    const rulesResult = await this.previewRules(
      { kind: 'rules-all' },
      nextRules,
      'profile-activation',
    )

    return {
      ...this.buildResult(
        scope,
        [...clientResult.entries, ...rulesResult.entries],
        [...clientResult.blockers, ...rulesResult.blockers],
      ),
      profileSummary: {
        profileId: profile.id,
        profileName: profile.name,
        serverOverrides: this.buildProfileOverrideSummary(
          currentServers,
          profile.serverOverrides,
          'server',
        ),
        ruleOverrides: this.buildProfileOverrideSummary(
          currentRules,
          profile.ruleOverrides,
          'rule',
        ),
      },
    }
  }

  private async previewClientEntries(
    clientId: ClientId,
    options: SyncClientOptions | undefined,
    allowCreateConfigIfMissing: boolean,
    serversOverride: readonly McpServer[] | undefined,
    origin: SyncPlanOrigin,
  ): Promise<{ entries: SyncPlanFileEntry[]; blockers: SyncPlanBlocker[] }> {
    const adapter = ADAPTERS.get(clientId)
    if (!adapter) {
      return { entries: [], blockers: [] }
    }

    const { detection, manualConfigPath } = await resolveClientDetection(clientId, adapter)
    if (!detection.installed) {
      return { entries: [], blockers: [] }
    }

    const effectiveOptions = {
      ...(options ?? {}),
      ...(allowCreateConfigIfMissing ? { allowCreateConfigIfMissing: true } : {}),
    }

    const resolved = resolveConfigPathForSync(
      clientId,
      detection,
      manualConfigPath,
      effectiveOptions,
    )

    if (resolved.requiresConfigCreationConfirm) {
      const createPath =
        resolveConfigPathForSync(clientId, detection, manualConfigPath, {
          allowCreateConfigIfMissing: true,
        }).configPath ??
        getStoredManualConfigPath(clientId) ??
        undefined

      return {
        entries: [],
        blockers: [
          {
            id: `config-create-required:${clientId}`,
            title: `${adapter.displayName} needs a config file`,
            description: createPath
              ? `Confirm config creation before syncing. Planned path: ${createPath}`
              : `Confirm config creation before syncing ${adapter.displayName}.`,
            clientId,
            clientName: adapter.displayName,
            ...(createPath ? { path: createPath } : {}),
          },
        ],
      }
    }

    if (!resolved.configPath) {
      return {
        entries: [],
        blockers: [
          {
            id: `config-missing:${clientId}`,
            title: `${adapter.displayName} cannot be synced`,
            description: `${adapter.displayName} is installed but no writable config path could be resolved.`,
            clientId,
            clientName: adapter.displayName,
          },
        ],
      }
    }

    try {
      const preview = await createSyncService().previewSyncWithServers(
        adapter,
        resolved.configPath,
        serversOverride,
      )
      const meaningfulItems = preview.items.filter((item) =>
        MEANINGFUL_MCP_ACTIONS.has(item.action),
      )
      if (meaningfulItems.length === 0) {
        return { entries: [], blockers: [] }
      }

      const action: SyncPlanFileAction = existsSync(resolved.configPath) ? 'modify' : 'create'
      return {
        entries: [
          {
            id: `mcp:${clientId}:${resolved.configPath}`,
            path: resolved.configPath,
            feature: 'mcp-config',
            origin,
            action,
            clientId,
            clientName: adapter.displayName,
            detail: {
              kind: 'mcp',
              items: preview.items,
            },
          },
        ],
        blockers: [],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        entries: [],
        blockers: [
          {
            id: `preview-failed:${clientId}`,
            title: `Could not preview ${adapter.displayName}`,
            description: message,
            clientId,
            clientName: adapter.displayName,
            path: resolved.configPath,
          },
        ],
      }
    }
  }

  private buildResult(
    scope: SyncPlanScope,
    entries: SyncPlanFileEntry[],
    blockers: SyncPlanBlocker[],
  ): SyncPlanResult {
    const sortedEntries = [...entries].sort(compareEntries)
    const createCount = sortedEntries.filter((entry) => entry.action === 'create').length
    const modifyCount = sortedEntries.filter((entry) => entry.action === 'modify').length
    const removeCount = sortedEntries.filter((entry) => entry.action === 'remove').length
    const confirmable =
      blockers.length === 0 && (sortedEntries.length > 0 || scope.kind === 'profile-activate')

    return {
      scope,
      generatedAt: new Date().toISOString(),
      entries: sortedEntries,
      blockers,
      totalFiles: sortedEntries.length,
      createCount,
      modifyCount,
      removeCount,
      confirmable,
    }
  }

  private async getInstalledClientIds(): Promise<ClientId[]> {
    const installedIds: ClientId[] = []

    for (const clientId of ADAPTER_IDS) {
      const adapter = ADAPTERS.get(clientId)
      if (!adapter) continue

      const { detection } = await resolveClientDetection(clientId, adapter)
      if (detection.installed) {
        installedIds.push(clientId)
      }
    }

    return installedIds
  }

  private applyServerOverrides(
    servers: readonly McpServer[],
    overrides: Record<
      string,
      {
        readonly enabled: boolean
        readonly clientOverrides?: Readonly<Record<ClientId, { readonly enabled: boolean }>>
      }
    >,
  ): McpServer[] {
    return servers.map((server) => {
      const override = overrides[server.id]
      if (!override) return server

      return {
        ...server,
        enabled: override.enabled,
        clientOverrides: override.clientOverrides
          ? { ...server.clientOverrides, ...override.clientOverrides }
          : server.clientOverrides,
      }
    })
  }

  private applyRuleOverrides(
    rules: readonly AiRule[],
    overrides: Record<
      string,
      {
        readonly enabled: boolean
        readonly clientOverrides?: Readonly<Record<ClientId, { readonly enabled: boolean }>>
      }
    >,
  ): AiRule[] {
    return rules.map((rule) => {
      const override = overrides[rule.id]
      if (!override) return rule

      return {
        ...rule,
        enabled: override.enabled,
        clientOverrides: override.clientOverrides
          ? { ...rule.clientOverrides, ...override.clientOverrides }
          : rule.clientOverrides,
      }
    })
  }

  private buildProfileOverrideSummary(
    items: readonly McpServer[] | readonly AiRule[],
    overrides: Record<
      string,
      {
        readonly enabled: boolean
        readonly clientOverrides?: Readonly<Record<ClientId, { readonly enabled: boolean }>>
      }
    >,
    type: 'server' | 'rule',
  ): SyncPlanProfileOverrideItem[] {
    return Object.entries(overrides).map(([id, override]) => {
      const item = items.find((candidate) => candidate.id === id)
      return {
        id,
        name: item?.name ?? `${type}:${id}`,
        currentEnabled: item?.enabled ?? true,
        nextEnabled: override.enabled,
      }
    })
  }
}

export const syncPlanService = new SyncPlanService()
