/**
 * @file src/main/ipc/profiles.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for all profile-related channels. Wires the
 * renderer to `ProfilesRepo` for CRUD operations and orchestrates full sync
 * on activation: applies server + rule overrides, then runs `SyncService` and
 * `RulesSyncService` for every installed client.
 *
 * Activation sequence (`profiles:activate`):
 *   1. ProfilesRepo.setActive(id) — atomic transaction
 *   2. Apply serverOverrides → ServersRepo.update() per entry
 *   3. Apply ruleOverrides   → RulesRepo.update()   per entry
 *   4. For each installed client: run SyncService + RulesSyncService
 *   5. Log `profile.activated` to activity log
 *   6. Return SyncResult[]
 *
 * Guard: `profiles:delete` throws when the profile is currently active.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { Profile, SyncResult } from '@shared/types'
import type { CreateProfileInput, UpdateProfileInput } from '@shared/channels'
import { getDatabase } from '@main/db/connection'
import { ProfilesRepo } from '@main/db/profiles.repo'
import { ServersRepo } from '@main/db/servers.repo'
import { RulesRepo } from '@main/db/rules.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { BackupsRepo } from '@main/db/backups.repo'
import { BackupService } from '@main/sync/backup.service'
import { SyncService } from '@main/sync/sync.service'
import { RulesSyncService } from '@main/rules/rules-sync.service'
import { ADAPTERS, ADAPTER_IDS } from '@main/clients/registry'

// ─── Service Factory ──────────────────────────────────────────────────────────

/**
 * Creates fully-wired repo instances backed by the live SQLite database.
 */
const createRepos = () => {
  const db = getDatabase()
  return {
    profiles: new ProfilesRepo(db),
    servers: new ServersRepo(db),
    rules: new RulesRepo(db),
    log: new ActivityLogRepo(db),
    backups: new BackupsRepo(db),
  }
}

/**
 * Creates a `SyncService` wired to the live database.
 */
const createSyncService = () => {
  const db = getDatabase()
  return new SyncService(
    new ServersRepo(db),
    new ActivityLogRepo(db),
    new BackupService(new BackupsRepo(db)),
  )
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `profiles:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerProfilesIpc = (): void => {
  // ── profiles:list ──────────────────────────────────────────────────────────
  ipcMain.handle('profiles:list', (): Profile[] => {
    log.debug('[ipc] profiles:list')
    return createRepos().profiles.findAll()
  })

  // ── profiles:get ───────────────────────────────────────────────────────────
  ipcMain.handle('profiles:get', (_event, id: string): Profile | null => {
    log.debug(`[ipc] profiles:get ${id}`)
    return createRepos().profiles.findById(id)
  })

  // ── profiles:create ────────────────────────────────────────────────────────
  ipcMain.handle('profiles:create', (_event, input: CreateProfileInput): Profile => {
    log.debug(`[ipc] profiles:create "${input.name}"`)
    const { profiles, log: logRepo } = createRepos()
    const profile = profiles.create(input)
    logRepo.insert({ action: 'profile.created', details: { profileName: profile.name } })
    return profile
  })

  // ── profiles:update ────────────────────────────────────────────────────────
  ipcMain.handle('profiles:update', (_event, id: string, updates: UpdateProfileInput): Profile => {
    log.debug(`[ipc] profiles:update ${id}`)
    const { profiles, log: logRepo } = createRepos()
    const profile = profiles.update(id, updates)
    logRepo.insert({
      action: 'profile.updated',
      details: { profileName: profile.name, updatedFields: Object.keys(updates) },
    })
    return profile
  })

  // ── profiles:delete ────────────────────────────────────────────────────────
  ipcMain.handle('profiles:delete', (_event, id: string): void => {
    log.debug(`[ipc] profiles:delete ${id}`)
    const { profiles, log: logRepo } = createRepos()
    const profile = profiles.findById(id)

    if (profile?.isActive) {
      throw new Error('Cannot delete the active profile — activate another profile first')
    }

    profiles.delete(id)
    logRepo.insert({
      action: 'profile.deleted',
      details: { profileName: profile?.name ?? id },
    })
  })

  // ── profiles:activate ──────────────────────────────────────────────────────
  ipcMain.handle('profiles:activate', async (_event, id: string): Promise<SyncResult[]> => {
    log.debug(`[ipc] profiles:activate ${id}`)
    const { profiles, servers, rules, log: logRepo } = createRepos()

    const profile = profiles.findById(id)
    if (!profile) throw new Error(`Profile not found: ${id}`)

    // Step 1: Mark profile as active (atomic transaction)
    profiles.setActive(id)

    // Step 2: Apply server overrides
    for (const [serverId, override] of Object.entries(profile.serverOverrides)) {
      try {
        servers.update(serverId, {
          enabled: override.enabled,
          ...(override.clientOverrides && { clientOverrides: override.clientOverrides }),
        })
      } catch (err) {
        log.warn(
          `[ipc] profiles:activate — failed to apply server override for ${serverId}: ${String(err)}`,
        )
      }
    }

    // Step 3: Apply rule overrides
    for (const [ruleId, override] of Object.entries(profile.ruleOverrides)) {
      try {
        rules.update(ruleId, {
          enabled: override.enabled,
          ...(override.clientOverrides && { clientOverrides: override.clientOverrides }),
        })
      } catch (err) {
        log.warn(
          `[ipc] profiles:activate — failed to apply rule override for ${ruleId}: ${String(err)}`,
        )
      }
    }

    // Step 4: Sync all installed clients (servers + rules)
    const syncService = createSyncService()
    const rulesSyncService = new RulesSyncService(getDatabase())
    const results: SyncResult[] = []

    for (const clientId of ADAPTER_IDS) {
      const detection = await ADAPTERS.get(clientId)!.detect()
      if (!detection.installed) continue

      // Server sync
      if (detection.configPaths.length > 0) {
        const adapter = ADAPTERS.get(clientId)!
        const result = await syncService.sync(adapter, detection.configPaths[0]!)
        results.push(result)
      }

      // Rules sync
      const rulesResult = rulesSyncService.sync(clientId)
      if (!rulesResult.success) {
        log.warn(
          `[ipc] profiles:activate — rules sync failed for ${clientId}: ${rulesResult.error ?? ''}`,
        )
      }
    }

    // Step 5: Log activation
    logRepo.insert({
      action: 'profile.activated',
      details: {
        profileName: profile.name,
        clientsSynced: results.length,
      },
    })

    log.info(
      `[ipc] profiles:activate complete — profile "${profile.name}", ${results.length} client(s) synced`,
    )
    return results
  })

  log.info('[ipc] profiles handlers registered')
}
