/**
 * @file src/main/sync/sync.service.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Safety-first sync service. Implements the 8-step pre-write
 * sequence defined in PLAN.md section 5.5:
 *   1. READ   — load current config
 *   2. PARSE  — validate JSON
 *   3. BACKUP — pristine + regular backup
 *   4. MERGE  — overlay managed servers, preserve unmanaged entries
 *   5. VALIDATE — round-trip check
 *   6. WRITE  — atomic tmp → rename
 *   7. VERIFY — re-read and compare
 *   8. LOG    — record in activity log
 *
 * If any step fails the method throws, leaving the original file untouched.
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import log from 'electron-log'
import type { ClientId, McpServer, SyncResult } from '@shared/types'
import type { ClientAdapter } from '@main/clients/types'
import type { ActivityLogRepo } from '@main/db/activity-log.repo'
import type { ServersRepo } from '@main/db/servers.repo'
import type { BackupService } from './backup.service'
import { getSecret } from '@main/secrets/keytar.service'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw JSON shape of a client config file. Preserving the unknown-key index
 * is important so we never lose fields that aidrelay doesn't manage.
 */
interface ClientConfig {
  [key: string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the server map that should be written to a client config.
 * Only includes servers that are enabled globally AND enabled for this client
 * (or have no per-client override). Unmanaged servers already in the client
 * config are left alone — they are preserved during the merge step.
 *
 * Secret env vars are fetched from the Windows Credential Manager and injected
 * in-place before the config is written. If a secret cannot be retrieved, that
 * key is omitted from the written env block and a warning is logged.
 *
 * @param servers  - All servers in the aidrelay registry.
 * @param clientId - The client being synced.
 * @returns Map of server name → minimal config shape expected by the client.
 */
const buildManagedMap = async (
  servers: McpServer[],
  clientId: ClientId,
): Promise<Record<string, unknown>> => {
  const result: Record<string, unknown> = {}

  for (const server of servers) {
    const clientOverride = server.clientOverrides[clientId]
    const enabledForClient = clientOverride !== undefined ? clientOverride.enabled : server.enabled

    if (!server.enabled || !enabledForClient) continue

    // Build the env block, injecting secret values from the OS credential store.
    const envBlock: Record<string, string> = { ...server.env }
    for (const secretKey of server.secretEnvKeys) {
      const secretValue = await getSecret(server.name, secretKey)
      if (secretValue !== null) {
        envBlock[secretKey] = secretValue
      } else {
        log.warn(`[sync] secret "${secretKey}" not found for server "${server.name}" — skipping`)
      }
    }

    result[server.name] = {
      command: server.command,
      ...(server.args.length > 0 && { args: [...server.args] }),
      ...(Object.keys(envBlock).length > 0 && { env: envBlock }),
      ...(server.type !== 'stdio' && { type: server.type }),
    }
  }

  return result
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Orchestrates the full 8-step safety-first sync for one client config file.
 */
export class SyncService {
  constructor(
    private readonly serversRepo: ServersRepo,
    private readonly activityLogRepo: ActivityLogRepo,
    private readonly backupService: BackupService,
  ) {}

  /**
   * Syncs all enabled aidrelay servers to the given client's config file.
   * Existing unmanaged entries in the file are preserved.
   *
   * @param adapter - The client adapter that knows how to read/write this client.
   * @param configPath - Absolute path to the client config file to update.
   * @returns Sync result indicating success, server count, and timestamp.
   * @throws {Error} If any step in the safety sequence fails.
   */
  async sync(adapter: ClientAdapter, configPath: string): Promise<SyncResult> {
    const clientId = adapter.id
    const syncedAt = new Date().toISOString()

    log.info(`[sync] starting sync for ${clientId} → ${configPath}`)

    try {
      // ── Step 1: READ ──────────────────────────────────────────────────────
      const fileExists = existsSync(configPath)
      let rawContent = fileExists ? readFileSync(configPath, 'utf-8') : '{}'

      // ── Step 2: PARSE ─────────────────────────────────────────────────────
      let existingConfig: ClientConfig
      try {
        existingConfig = JSON.parse(rawContent) as ClientConfig
      } catch (err) {
        throw new Error(`Config parse failed (step 2): ${String(err)}`)
      }

      // ── Step 3: BACKUP ────────────────────────────────────────────────────
      if (fileExists) {
        this.backupService.ensurePristineBackup(clientId, configPath)
        this.backupService.createBackup(clientId, configPath, 'sync')
        this.backupService.pruneOldBackups(clientId)
      }

      // ── Step 4: MERGE ─────────────────────────────────────────────────────
      const allServers = this.serversRepo.findAll()
      // Inject secrets from the OS credential store for each server.
      const managedMap = await buildManagedMap(allServers, clientId)

      // Get the currently existing server entries from the client config
      const schemaKey = adapter.schemaKey
      const existingServers = (existingConfig[schemaKey] ?? {}) as Record<string, unknown>

      // Identify which keys in the existing config are NOT managed by aidrelay.
      // These are preserved unchanged — we only touch our own entries.
      const managedNames = new Set(Object.keys(managedMap))
      const unmanagedEntries: Record<string, unknown> = {}
      for (const [name, config] of Object.entries(existingServers)) {
        if (!managedNames.has(name)) {
          unmanagedEntries[name] = config
        }
      }

      const mergedServers = { ...unmanagedEntries, ...managedMap }
      const mergedConfig: ClientConfig = { ...existingConfig, [schemaKey]: mergedServers }

      // ── Step 5: VALIDATE ──────────────────────────────────────────────────
      let mergedJson: string
      try {
        mergedJson = JSON.stringify(mergedConfig, null, 2)
        JSON.parse(mergedJson) // round-trip check
      } catch (err) {
        throw new Error(`Merged config failed validation (step 5): ${String(err)}`)
      }

      // ── Step 6: WRITE (atomic) ────────────────────────────────────────────
      const tmpPath = `${configPath}.aidrelay.tmp`
      try {
        writeFileSync(tmpPath, mergedJson, 'utf-8')
        renameSync(tmpPath, configPath)
      } catch (err) {
        throw new Error(`Atomic write failed (step 6): ${String(err)}`)
      }

      // ── Step 7: VERIFY ────────────────────────────────────────────────────
      try {
        rawContent = readFileSync(configPath, 'utf-8')
        const verified = JSON.parse(rawContent) as ClientConfig
        const verifiedServers = verified[schemaKey] as Record<string, unknown> | undefined
        const writtenKeys = Object.keys(verifiedServers ?? {})
        const expectedKeys = Object.keys(mergedServers)

        if (writtenKeys.length !== expectedKeys.length) {
          throw new Error(
            `Server count mismatch after write: expected ${expectedKeys.length}, got ${writtenKeys.length}`,
          )
        }
      } catch (err) {
        throw new Error(`Post-write verification failed (step 7): ${String(err)}`)
      }

      // ── Step 8: LOG ───────────────────────────────────────────────────────
      this.activityLogRepo.insert({
        action: 'sync.performed',
        details: {
          configPath,
          serversWritten: Object.keys(managedMap).length,
          unmanagedPreserved: Object.keys(unmanagedEntries).length,
        },
        clientId,
      })

      const serversWritten = Object.keys(managedMap).length
      log.info(`[sync] completed for ${clientId}: ${serversWritten} server(s) written`)

      return { clientId, success: true, serversWritten, syncedAt }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`[sync] failed for ${clientId}: ${message}`)

      this.activityLogRepo.insert({
        action: 'sync.failed',
        details: { configPath, error: message },
        clientId,
      })

      return {
        clientId,
        success: false,
        serversWritten: 0,
        error: message,
        syncedAt,
      }
    }
  }
}
