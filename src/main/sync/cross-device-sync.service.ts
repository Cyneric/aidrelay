/**
 * @file src/main/sync/cross-device-sync.service.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Assisted cross-device sync service. Coordinates git sync pulls,
 * detects changes, categorizes them into safe/unsafe changes, and queues pending
 * setups for user intervention.
 */

import log from 'electron-log'
import { gitSyncService } from '@main/git-sync/git-sync.service'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { RulesRepo } from '@main/db/rules.repo'
import { ProfilesRepo } from '@main/db/profiles.repo'
import { SyncInstallIntentRepo } from '@main/db/sync-install-intent.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { DeviceSetupStateRepo } from '@main/db/device-setup-state.repo'
import { BackupsRepo } from '@main/db/backups.repo'
import { getSecret } from '@main/secrets/keytar.service'
import { ADAPTERS, ADAPTER_IDS } from '@main/clients/registry'
import { SyncService } from '@main/sync/sync.service'
import { BackupService } from '@main/sync/backup.service'
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import Database from 'better-sqlite3'
import { resolveClientDetection, resolveConfigPathForSync } from '@main/ipc/clients.ipc'
import os from 'os'
import type {
  McpServer,
  AiRule,
  Profile,
  SyncedInstallIntent,
  PendingSetup,
  SyncConflict,
  DeviceSetupState,
} from '@shared/types'
import { diffArrays } from './array-diff.helper'

// ─── Internal Types ───────────────────────────────────────────────────────────

interface Snapshot {
  servers: McpServer[]
  rules: AiRule[]
  profiles: Profile[]
  installIntents: SyncedInstallIntent[]
}

interface EntityDiff<T> {
  readonly added: readonly T[]
  readonly removed: readonly T[]
  readonly modified: readonly T[]
}

interface PullDiff {
  servers: EntityDiff<McpServer>
  rules: EntityDiff<AiRule>
  profiles: EntityDiff<Profile>
  installIntents: EntityDiff<SyncedInstallIntent>
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Provides assisted cross-device sync operations. Use the exported singleton
 * `crossDeviceSyncService` — do not instantiate this class directly.
 */
class CrossDeviceSyncService {
  private readonly deviceId: string

  constructor() {
    this.deviceId = os.hostname()
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private createRepos(): {
    servers: ServersRepo
    rules: RulesRepo
    profiles: ProfilesRepo
    installIntents: SyncInstallIntentRepo
    deviceSetupState: DeviceSetupStateRepo
    log: ActivityLogRepo
  } {
    const db = getDatabase()
    return {
      servers: new ServersRepo(db),
      rules: new RulesRepo(db),
      profiles: new ProfilesRepo(db),
      installIntents: new SyncInstallIntentRepo(db),
      deviceSetupState: new DeviceSetupStateRepo(db),
      log: new ActivityLogRepo(db),
    }
  }

  private captureSnapshot(repos: ReturnType<CrossDeviceSyncService['createRepos']>): Snapshot {
    return {
      servers: repos.servers.findAll(),
      rules: repos.rules.findAll(),
      profiles: repos.profiles.findAll(),
      installIntents: repos.installIntents.listAll(),
    }
  }

  private computeDiff(before: Snapshot, after: Snapshot): PullDiff {
    return {
      servers: diffArrays(before.servers, after.servers, (s) => s.id),
      rules: diffArrays(before.rules, after.rules, (r) => r.id),
      profiles: diffArrays(before.profiles, after.profiles, (p) => p.id),
      installIntents: diffArrays(before.installIntents, after.installIntents, (i) => i.serverId),
    }
  }

  private logDiff(diff: PullDiff): void {
    const { servers, rules, profiles, installIntents } = diff

    if (
      servers.added.length === 0 &&
      servers.removed.length === 0 &&
      servers.modified.length === 0 &&
      rules.added.length === 0 &&
      rules.removed.length === 0 &&
      rules.modified.length === 0 &&
      profiles.added.length === 0 &&
      profiles.removed.length === 0 &&
      profiles.modified.length === 0 &&
      installIntents.added.length === 0 &&
      installIntents.removed.length === 0 &&
      installIntents.modified.length === 0
    ) {
      log.info('[cross-device-sync] No changes detected')
      return
    }

    log.info('[cross-device-sync] Pull diff detection results:')
    if (servers.added.length > 0) log.info(`  Servers added: ${servers.added.length}`)
    if (servers.removed.length > 0) log.info(`  Servers removed: ${servers.removed.length}`)
    if (servers.modified.length > 0) log.info(`  Servers modified: ${servers.modified.length}`)
    if (rules.added.length > 0) log.info(`  Rules added: ${rules.added.length}`)
    if (rules.removed.length > 0) log.info(`  Rules removed: ${rules.removed.length}`)
    if (rules.modified.length > 0) log.info(`  Rules modified: ${rules.modified.length}`)
    if (profiles.added.length > 0) log.info(`  Profiles added: ${profiles.added.length}`)
    if (profiles.removed.length > 0) log.info(`  Profiles removed: ${profiles.removed.length}`)
    if (profiles.modified.length > 0) log.info(`  Profiles modified: ${profiles.modified.length}`)
    if (installIntents.added.length > 0)
      log.info(`  Install intents added: ${installIntents.added.length}`)
    if (installIntents.removed.length > 0)
      log.info(`  Install intents removed: ${installIntents.removed.length}`)
    if (installIntents.modified.length > 0)
      log.info(`  Install intents modified: ${installIntents.modified.length}`)
  }

  private async categorizeChanges(
    diff: PullDiff,
    repos: ReturnType<CrossDeviceSyncService['createRepos']>,
  ): Promise<{ pending: PendingSetup[]; ready: string[] }> {
    const pending: PendingSetup[] = []
    const ready: string[] = []

    // Helper to check if runtime detection passes
    const runtimeDetectionPassed = (deviceState: DeviceSetupState | null): boolean => {
      if (!deviceState) return false
      const results = deviceState.runtimeDetectionResults
      return Object.values(results).every(Boolean)
    }

    // Check added/modified servers
    for (const server of [...diff.servers.added, ...diff.servers.modified]) {
      // 1. Secrets check
      const missingSecrets: string[] = []
      for (const key of server.secretEnvKeys) {
        const secret = await getSecret(server.name, key)
        if (!secret) {
          missingSecrets.push(key)
        }
      }
      for (const key of server.secretHeaderKeys) {
        const secret = await getSecret(server.name, key)
        if (!secret) {
          missingSecrets.push(key)
        }
      }

      if (missingSecrets.length > 0) {
        pending.push({
          serverId: server.id,
          serverName: server.name,
          reason: 'missing_secrets',
          actions: [`Bind ${missingSecrets.length} secret(s)`],
        })
        continue
      }

      // 2. Install intent check
      const installIntent = repos.installIntents.findByServerId(server.id)
      const deviceState = repos.deviceSetupState.findByServerId(this.deviceId, server.id)

      if (installIntent) {
        // Server requires local installation
        if (!deviceState || deviceState.installStatus !== 'success') {
          pending.push({
            serverId: server.id,
            serverName: server.name,
            reason: 'install_required',
            actions: ['Run installation wizard'],
          })
          repos.servers.updateSetupStatus(server.id, 'needs_setup')
          continue
        }

        // Install succeeded, check runtime detection
        if (!runtimeDetectionPassed(deviceState)) {
          pending.push({
            serverId: server.id,
            serverName: server.name,
            reason: 'missing_runtime',
            actions: ['Check runtime prerequisites'],
          })
          repos.servers.updateSetupStatus(server.id, 'needs_setup')
          continue
        }

        // Server fully ready on this device
        this.ensureDeviceSetupStateSuccess(repos, server.id, server.name)
        ready.push(server.id)
        // If server has no secrets, it's globally ready
        const hasNoSecrets =
          server.secretEnvKeys.length === 0 && server.secretHeaderKeys.length === 0
        if (hasNoSecrets) {
          repos.servers.updateSetupStatus(server.id, 'ready')
        }
      } else {
        // No install intent — server is ready on this device (secrets already present)
        this.ensureDeviceSetupStateSuccess(repos, server.id, server.name)
        ready.push(server.id)
        // If server has no secrets, it's globally ready
        const hasNoSecrets =
          server.secretEnvKeys.length === 0 && server.secretHeaderKeys.length === 0
        if (hasNoSecrets) {
          repos.servers.updateSetupStatus(server.id, 'ready')
        }
      }
    }

    // Check added/modified install intents (for servers not already processed)
    for (const intent of [...diff.installIntents.added, ...diff.installIntents.modified]) {
      const server = repos.servers.findById(intent.serverId)
      if (!server) continue

      // Skip if server already processed in the loop above
      const alreadyProcessed = [...diff.servers.added, ...diff.servers.modified].some(
        (s) => s.id === intent.serverId,
      )
      if (alreadyProcessed) continue

      const deviceState = repos.deviceSetupState.findByServerId(this.deviceId, intent.serverId)
      if (!deviceState || deviceState.installStatus !== 'success') {
        pending.push({
          serverId: intent.serverId,
          serverName: server.name,
          reason: 'install_required',
          actions: ['Run installation wizard'],
        })
        repos.servers.updateSetupStatus(intent.serverId, 'needs_setup')
        continue
      }

      if (!runtimeDetectionPassed(deviceState)) {
        pending.push({
          serverId: intent.serverId,
          serverName: server.name,
          reason: 'missing_runtime',
          actions: ['Check runtime prerequisites'],
        })
        repos.servers.updateSetupStatus(intent.serverId, 'needs_setup')
        continue
      }

      // Install intent satisfied, server ready on this device
      this.ensureDeviceSetupStateSuccess(repos, intent.serverId, server.name)
      ready.push(intent.serverId)
      const hasNoSecrets = server.secretEnvKeys.length === 0 && server.secretHeaderKeys.length === 0
      if (hasNoSecrets) {
        repos.servers.updateSetupStatus(intent.serverId, 'ready')
      }
    }

    return { pending, ready }
  }

  /**
   * Computes pending setup items for all servers on this device.
   * Evaluates secret availability, install intent status, and runtime detection.
   */
  private async computePendingSetups(): Promise<PendingSetup[]> {
    const repos = this.createRepos()
    const pending: PendingSetup[] = []

    const runtimeDetectionPassed = (deviceState: DeviceSetupState | null): boolean => {
      if (!deviceState) return false
      const results = deviceState.runtimeDetectionResults
      return Object.values(results).every(Boolean)
    }

    // Check all servers
    const servers = repos.servers.findAll()
    for (const server of servers) {
      // Secrets check
      const missingSecrets: string[] = []
      for (const key of server.secretEnvKeys) {
        const secret = await getSecret(server.name, key)
        if (!secret) missingSecrets.push(key)
      }
      for (const key of server.secretHeaderKeys) {
        const secret = await getSecret(server.name, key)
        if (!secret) missingSecrets.push(key)
      }
      if (missingSecrets.length > 0) {
        pending.push({
          serverId: server.id,
          serverName: server.name,
          reason: 'missing_secrets',
          actions: [`Bind ${missingSecrets.length} secret(s)`],
        })
        continue
      }

      // Install intent check
      const installIntent = repos.installIntents.findByServerId(server.id)
      const deviceState = repos.deviceSetupState.findByServerId(this.deviceId, server.id)

      if (installIntent) {
        if (!deviceState || deviceState.installStatus !== 'success') {
          pending.push({
            serverId: server.id,
            serverName: server.name,
            reason: 'install_required',
            actions: ['Run installation wizard'],
          })
          continue
        }
        if (!runtimeDetectionPassed(deviceState)) {
          pending.push({
            serverId: server.id,
            serverName: server.name,
            reason: 'missing_runtime',
            actions: ['Check runtime prerequisites'],
          })
          continue
        }
        // Server ready on this device (secrets already present)
      }
      // If no install intent, server is ready (secrets already present)
    }

    // Install intents without corresponding servers (should not happen) are ignored
    return pending
  }

  private async syncReadyServers(readyServerIds: string[]): Promise<void> {
    if (readyServerIds.length === 0) return

    log.info(`[cross-device-sync] Auto-syncing ${readyServerIds.length} ready server(s) to clients`)

    const db = getDatabase()
    const activityLogRepo = new ActivityLogRepo(db)
    const backupsRepo = new BackupsRepo(db)
    const backupService = new BackupService(backupsRepo)

    // Create filtered repo that only returns ready servers
    class FilteredServersRepo extends ServersRepo {
      private readonly allowedIds = new Set(readyServerIds)
      constructor(db: Database.Database) {
        super(db)
      }
      findAll(): McpServer[] {
        return super.findAll().filter((server) => this.allowedIds.has(server.id))
      }
    }
    const filteredRepo = new FilteredServersRepo(db)
    const filteredSyncService = new SyncService(filteredRepo, activityLogRepo, backupService)

    // Sync each client
    for (const clientId of ADAPTER_IDS) {
      const adapter = ADAPTERS.get(clientId)
      if (!adapter) continue

      const { detection, manualConfigPath } = await resolveClientDetection(clientId, adapter)
      const { configPath, requiresConfigCreationConfirm } = resolveConfigPathForSync(
        clientId,
        detection,
        manualConfigPath,
        { allowCreateConfigIfMissing: true },
      )
      if (requiresConfigCreationConfirm || !configPath) {
        // Skip clients that need manual confirmation or have no config path
        continue
      }

      try {
        await filteredSyncService.sync(adapter, configPath)
        log.debug(`[cross-device-sync] Auto-synced ${clientId}`)
      } catch (err) {
        log.warn(`[cross-device-sync] Auto-sync failed for ${clientId}:`, err)
      }
    }
  }

  private ensureDeviceSetupStateSuccess(
    repos: ReturnType<CrossDeviceSyncService['createRepos']>,
    serverId: string,
    serverName: string,
  ): void {
    const existing = repos.deviceSetupState.findByServerId(this.deviceId, serverId)
    if (existing && existing.installStatus === 'success') {
      return
    }

    const now = new Date().toISOString()
    repos.deviceSetupState.upsert({
      deviceId: this.deviceId,
      serverId,
      runtimeDetectionResults: {},
      logs: [],
      installStatus: 'success',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    log.info(`[cross-device-sync] Marked server "${serverName}" as ready on this device`)
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Performs an automatic pull from the configured git remote, detects changes
   * at the entity level, logs the diff, and categorizes changes for further
   * processing (safe auto-apply, pending setup, conflicts).
   *
   * @returns `true` if changes were detected, `false` if the remote was already
   *   up to date or git sync is not connected.
   */
  async autoPull(): Promise<boolean> {
    log.info('[cross-device-sync] Starting auto-pull')

    const status = await gitSyncService.getStatus()
    if (!status.connected) {
      log.info('[cross-device-sync] Git sync not connected, skipping auto-pull')
      return false
    }

    const repos = this.createRepos()
    const before = this.captureSnapshot(repos)

    const pullResult = await gitSyncService.pull()
    if (!pullResult.success) {
      log.error('[cross-device-sync] Pull failed:', pullResult.error)
      return false
    }

    // If nothing was imported and no conflicts, remote was already up to date.
    if (
      pullResult.serversImported === 0 &&
      pullResult.rulesImported === 0 &&
      pullResult.profilesImported === 0 &&
      pullResult.installIntentsImported === 0 &&
      pullResult.skillsImported === 0 &&
      pullResult.conflicts === 0 &&
      pullResult.skillConflicts === 0 &&
      pullResult.skillMappingsRequired === 0
    ) {
      log.info('[cross-device-sync] Remote already up to date')
      return false
    }

    const after = this.captureSnapshot(repos)
    const diff = this.computeDiff(before, after)
    this.logDiff(diff)

    // Categorize changes for auto-apply (Task 82)
    const { pending, ready } = await this.categorizeChanges(diff, repos)
    if (pending.length > 0) {
      log.info(`[cross-device-sync] ${pending.length} pending setup(s) requiring user intervention`)
      for (const item of pending) {
        log.info(`  - ${item.serverName}: ${item.reason}`)
      }
      // Pending setups are computed on demand via listPending()
    } else {
      log.info('[cross-device-sync] All changes auto-applied successfully')
    }
    // Auto-sync ready servers to clients
    await this.syncReadyServers(ready)
    // TODO: Record conflicts (Task 85)

    // Log summary using pull result counts (should match diff totals)
    log.info(
      `[cross-device-sync] Pull summary: ${pullResult.serversImported} servers, ` +
        `${pullResult.rulesImported} rules, ${pullResult.profilesImported} profiles, ` +
        `${pullResult.installIntentsImported} install intents, ${pullResult.skillsImported} skills, ` +
        `${pullResult.conflicts} registry conflict(s), ${pullResult.skillConflicts} skill conflict(s), ` +
        `${pullResult.skillMappingsRequired} mapping prompt(s)`,
    )

    return true
  }

  /**
   * Lists pending setup items that require user intervention after a sync.
   */
  async listPending(): Promise<PendingSetup[]> {
    return this.computePendingSetups()
  }

  /**
   * Applies a pending setup item (e.g., install missing runtime, bind secrets).
   * (To be implemented in Task 83.)
   */
  async applyPending(serverId: string): Promise<void> {
    void serverId
    // TODO: Implement pending setup application
    await Promise.resolve()
    throw new Error('Not implemented')
  }

  /**
   * Lists unresolved sync conflicts between local and remote versions.
   * (To be implemented in Task 85.)
   */
  async listConflicts(): Promise<SyncConflict[]> {
    // TODO: Query conflicts from database
    await Promise.resolve()
    return []
  }

  /**
   * Resolves a conflict by choosing either the local or remote value.
   * (To be implemented in Task 85.)
   */
  async resolveConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<void> {
    void conflictId
    void resolution
    // TODO: Implement conflict resolution
    await Promise.resolve()
    throw new Error('Not implemented')
  }

  /**
   * Lists changes that would be pushed to the remote on the next sync,
   * for user review before pushing.
   */
  async pushReview(): Promise<SyncConflict[]> {
    const repos = this.createRepos()
    const localSnapshot: Snapshot = {
      servers: repos.servers.findAll(),
      rules: repos.rules.findAll(),
      profiles: repos.profiles.findAll(),
      installIntents: repos.installIntents.listAll(),
    }

    let headSnapshot: Snapshot
    try {
      headSnapshot = await gitSyncService.getHeadSnapshot()
    } catch (err) {
      log.warn('[cross-device-sync] Could not read HEAD snapshot:', err)
      return []
    }

    // Compute diff between local and HEAD
    const diff = {
      servers: diffArrays(headSnapshot.servers, localSnapshot.servers, (s) => s.id),
      rules: diffArrays(headSnapshot.rules, localSnapshot.rules, (r) => r.id),
      profiles: diffArrays(headSnapshot.profiles, localSnapshot.profiles, (p) => p.id),
      installIntents: diffArrays(
        headSnapshot.installIntents,
        localSnapshot.installIntents,
        (i) => i.serverId,
      ),
    }

    const conflicts: SyncConflict[] = []

    // Helper to generate a unique conflict ID
    const conflictId = (type: string, id: string, suffix?: string) =>
      `${type}-${id}${suffix ? `-${suffix}` : ''}`

    // Process servers
    for (const server of diff.servers.added) {
      conflicts.push({
        id: conflictId('server', server.id, 'added'),
        serverId: server.id,
        serverName: server.name,
        field: 'server',
        localValue: server,
        remoteValue: null,
      })
    }
    for (const server of diff.servers.modified) {
      const remote = headSnapshot.servers.find((s) => s.id === server.id)
      conflicts.push({
        id: conflictId('server', server.id, 'modified'),
        serverId: server.id,
        serverName: server.name,
        field: 'server',
        localValue: server,
        remoteValue: remote ?? null,
      })
    }
    for (const server of diff.servers.removed) {
      conflicts.push({
        id: conflictId('server', server.id, 'removed'),
        serverId: server.id,
        serverName: server.name,
        field: 'server',
        localValue: null,
        remoteValue: server,
      })
    }

    // Process rules
    for (const rule of diff.rules.added) {
      conflicts.push({
        id: conflictId('rule', rule.id, 'added'),
        serverId: '',
        serverName: rule.name,
        field: 'rule',
        localValue: rule,
        remoteValue: null,
      })
    }
    for (const rule of diff.rules.modified) {
      const remote = headSnapshot.rules.find((r) => r.id === rule.id)
      conflicts.push({
        id: conflictId('rule', rule.id, 'modified'),
        serverId: '',
        serverName: rule.name,
        field: 'rule',
        localValue: rule,
        remoteValue: remote ?? null,
      })
    }
    for (const rule of diff.rules.removed) {
      conflicts.push({
        id: conflictId('rule', rule.id, 'removed'),
        serverId: '',
        serverName: rule.name,
        field: 'rule',
        localValue: null,
        remoteValue: rule,
      })
    }

    // Process profiles
    for (const profile of diff.profiles.added) {
      conflicts.push({
        id: conflictId('profile', profile.id, 'added'),
        serverId: '',
        serverName: profile.name,
        field: 'profile',
        localValue: profile,
        remoteValue: null,
      })
    }
    for (const profile of diff.profiles.modified) {
      const remote = headSnapshot.profiles.find((p) => p.id === profile.id)
      conflicts.push({
        id: conflictId('profile', profile.id, 'modified'),
        serverId: '',
        serverName: profile.name,
        field: 'profile',
        localValue: profile,
        remoteValue: remote ?? null,
      })
    }
    for (const profile of diff.profiles.removed) {
      conflicts.push({
        id: conflictId('profile', profile.id, 'removed'),
        serverId: '',
        serverName: profile.name,
        field: 'profile',
        localValue: null,
        remoteValue: profile,
      })
    }

    // Process install intents
    for (const intent of diff.installIntents.added) {
      conflicts.push({
        id: conflictId('install-intent', intent.serverId, 'added'),
        serverId: intent.serverId,
        serverName: intent.serverId, // No name, fallback to ID
        field: 'install-intent',
        localValue: intent,
        remoteValue: null,
      })
    }
    for (const intent of diff.installIntents.modified) {
      const remote = headSnapshot.installIntents.find((i) => i.serverId === intent.serverId)
      conflicts.push({
        id: conflictId('install-intent', intent.serverId, 'modified'),
        serverId: intent.serverId,
        serverName: intent.serverId,
        field: 'install-intent',
        localValue: intent,
        remoteValue: remote ?? null,
      })
    }
    for (const intent of diff.installIntents.removed) {
      conflicts.push({
        id: conflictId('install-intent', intent.serverId, 'removed'),
        serverId: intent.serverId,
        serverName: intent.serverId,
        field: 'install-intent',
        localValue: null,
        remoteValue: intent,
      })
    }

    return conflicts
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Application-wide singleton instance of the cross-device sync service.
 * All IPC handlers should import and use this instance directly.
 */
export const crossDeviceSyncService = new CrossDeviceSyncService()
