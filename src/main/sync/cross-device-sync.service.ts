/**
 * @file src/main/sync/cross-device-sync.service.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
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
import type {
  McpServer,
  AiRule,
  Profile,
  SyncedInstallIntent,
  PendingSetup,
  SyncConflict,
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
  // ── Private helpers ─────────────────────────────────────────────────────

  private createRepos(): {
    servers: ServersRepo
    rules: RulesRepo
    profiles: ProfilesRepo
    installIntents: SyncInstallIntentRepo
    log: ActivityLogRepo
  } {
    const db = getDatabase()
    return {
      servers: new ServersRepo(db),
      rules: new RulesRepo(db),
      profiles: new ProfilesRepo(db),
      installIntents: new SyncInstallIntentRepo(db),
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
      pullResult.conflicts === 0
    ) {
      log.info('[cross-device-sync] Remote already up to date')
      return false
    }

    const after = this.captureSnapshot(repos)
    const diff = this.computeDiff(before, after)
    this.logDiff(diff)

    // TODO: Categorize changes for auto-apply (Task 82)
    // TODO: Queue pending setups (Task 83)
    // TODO: Record conflicts (Task 85)

    // Log summary using pull result counts (should match diff totals)
    log.info(
      `[cross-device-sync] Pull summary: ${pullResult.serversImported} servers, ` +
        `${pullResult.rulesImported} rules, ${pullResult.profilesImported} profiles, ` +
        `${pullResult.installIntentsImported} install intents, ${pullResult.conflicts} conflict(s)`,
    )

    return true
  }

  /**
   * Lists pending setup items that require user intervention after a sync.
   * (To be implemented in Task 83.)
   */
  async listPending(): Promise<PendingSetup[]> {
    // TODO: Query pending setups from database
    await Promise.resolve()
    return []
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
   * (To be implemented in Task 84.)
   */
  async pushReview(): Promise<SyncConflict[]> {
    // TODO: Compute diff between local DB and git working tree
    await Promise.resolve()
    return []
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Application-wide singleton instance of the cross-device sync service.
 * All IPC handlers should import and use this instance directly.
 */
export const crossDeviceSyncService = new CrossDeviceSyncService()
