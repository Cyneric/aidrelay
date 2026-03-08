/**
 * @file src/main/ipc/clients.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for all client-related channels. Wires the renderer
 * to the adapter registry and the sync service. Every handler is registered with
 * `ipcMain.handle` so the renderer can call it via `ipcRenderer.invoke`.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import { join } from 'path'
import type {
  ClientId,
  ClientStatus,
  McpServerMap,
  SyncClientOptions,
  SyncResult,
  ValidationResult,
} from '@shared/types'
import { ADAPTERS, ADAPTER_IDS } from '@main/clients/registry'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { BackupsRepo } from '@main/db/backups.repo'
import { SettingsRepo } from '@main/db/settings.repo'
import { BackupService } from '@main/sync/backup.service'
import { SyncService } from '@main/sync/sync.service'
import { VISUAL_STUDIO_CONFIG_SETTING_KEY } from '@main/clients/visual-studio.adapter'

// ─── Service Factory ──────────────────────────────────────────────────────────

/**
 * Creates a fully-wired `SyncService` using the live SQLite database.
 * Called once per handler invocation to keep dependencies fresh.
 */
const createSyncService = (): SyncService => {
  const db = getDatabase()
  const serversRepo = new ServersRepo(db)
  const activityLogRepo = new ActivityLogRepo(db)
  const backupsRepo = new BackupsRepo(db)
  const backupService = new BackupService(backupsRepo)
  return new SyncService(serversRepo, activityLogRepo, backupService)
}

const resolveFallbackConfigPath = (clientId: ClientId): string | null => {
  switch (clientId) {
    case 'vscode': {
      const appData = process.env['APPDATA'] ?? ''
      return appData ? join(appData, 'Code', 'User', 'mcp.json') : null
    }
    case 'vscode-insiders': {
      const appData = process.env['APPDATA'] ?? ''
      return appData ? join(appData, 'Code - Insiders', 'User', 'mcp.json') : null
    }
    case 'codex-cli': {
      const userProfile = process.env['USERPROFILE'] ?? ''
      return userProfile ? join(userProfile, '.codex', 'config.json') : null
    }
    case 'codex-gui': {
      const appData = process.env['APPDATA'] ?? ''
      return appData ? join(appData, 'Codex', 'config.json') : null
    }
    case 'opencode': {
      const userProfile = process.env['USERPROFILE'] ?? ''
      return userProfile ? join(userProfile, '.config', 'opencode', 'opencode.json') : null
    }
    case 'visual-studio': {
      const repo = new SettingsRepo(getDatabase())
      const configured = repo.get<string>(VISUAL_STUDIO_CONFIG_SETTING_KEY)
      if (typeof configured === 'string' && configured.trim().length > 0) {
        return configured.trim()
      }
      return null
    }
    default:
      return null
  }
}

const resolveConfigPathForSync = (
  clientId: ClientId,
  detection: { installed: boolean; configPaths: readonly string[] },
  options?: SyncClientOptions,
): { configPath: string | null; requiresConfigCreationConfirm: boolean } => {
  if (!detection.installed) return { configPath: null, requiresConfigCreationConfirm: false }
  if (detection.configPaths.length > 0) {
    return { configPath: detection.configPaths[0]!, requiresConfigCreationConfirm: false }
  }
  const fallbackPath = resolveFallbackConfigPath(clientId)
  if (!fallbackPath) return { configPath: null, requiresConfigCreationConfirm: false }
  if (options?.allowCreateConfigIfMissing === true) {
    return { configPath: fallbackPath, requiresConfigCreationConfirm: false }
  }
  return { configPath: null, requiresConfigCreationConfirm: true }
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `clients:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerClientsIpc = (): void => {
  // ── clients:detect-all ────────────────────────────────────────────────────
  ipcMain.handle('clients:detect-all', async (): Promise<ClientStatus[]> => {
    log.debug('[ipc] clients:detect-all')

    const db = getDatabase()
    const activityLogRepo = new ActivityLogRepo(db)

    const results = await Promise.all(
      ADAPTER_IDS.map(async (id): Promise<ClientStatus> => {
        const adapter = ADAPTERS.get(id)!
        try {
          const detection = await adapter.detect()
          const latestSync = activityLogRepo.findLatestSyncByClient(id)
          const syncStatus =
            latestSync?.action === 'sync.failed'
              ? 'error'
              : latestSync?.action === 'sync.performed'
                ? 'synced'
                : 'never-synced'
          const lastSyncedAt =
            latestSync?.action === 'sync.performed' ? latestSync.timestamp : undefined
          return {
            id,
            displayName: adapter.displayName,
            installed: detection.installed,
            configPaths: detection.configPaths,
            serverCount: detection.serverCount,
            syncStatus,
            ...(lastSyncedAt ? { lastSyncedAt } : {}),
          }
        } catch (err) {
          log.warn(`[ipc] detect failed for ${id}: ${String(err)}`)
          return {
            id,
            displayName: adapter.displayName,
            installed: false,
            configPaths: [],
            serverCount: 0,
            syncStatus: 'error',
          }
        }
      }),
    )

    return results
  })

  // ── clients:read-config ───────────────────────────────────────────────────
  ipcMain.handle(
    'clients:read-config',
    async (_event, clientId: ClientId): Promise<McpServerMap> => {
      log.debug(`[ipc] clients:read-config ${clientId}`)

      const adapter = ADAPTERS.get(clientId)
      if (!adapter) return {}

      const detection = await adapter.detect()
      if (!detection.installed || detection.configPaths.length === 0) return {}

      return adapter.read(detection.configPaths[0]!)
    },
  )

  // ── clients:sync ──────────────────────────────────────────────────────────
  ipcMain.handle(
    'clients:sync',
    async (_event, clientId: ClientId, options?: SyncClientOptions): Promise<SyncResult> => {
      log.debug(`[ipc] clients:sync ${clientId}`)

      const adapter = ADAPTERS.get(clientId)
      if (!adapter) {
        return {
          clientId,
          success: false,
          serversWritten: 0,
          error: `No adapter registered for client: ${clientId}`,
          syncedAt: new Date().toISOString(),
        }
      }

      const detection = await adapter.detect()
      const { configPath, requiresConfigCreationConfirm } = resolveConfigPathForSync(
        clientId,
        detection,
        options,
      )
      if (requiresConfigCreationConfirm) {
        return {
          clientId,
          success: false,
          serversWritten: 0,
          errorCode: 'config_creation_required',
          error: `${adapter.displayName} has no config file yet. Confirm to create one.`,
          syncedAt: new Date().toISOString(),
        }
      }
      if (!configPath) {
        return {
          clientId,
          success: false,
          serversWritten: 0,
          error: `${adapter.displayName} is not installed or has no config file`,
          syncedAt: new Date().toISOString(),
        }
      }

      const syncService = createSyncService()
      return syncService.sync(adapter, configPath)
    },
  )

  // ── clients:sync-all ──────────────────────────────────────────────────────
  ipcMain.handle('clients:sync-all', async (): Promise<SyncResult[]> => {
    log.debug('[ipc] clients:sync-all')

    const syncService = createSyncService()
    const results: SyncResult[] = []

    for (const id of ADAPTER_IDS) {
      const adapter = ADAPTERS.get(id)!
      const detection = await adapter.detect()
      const { configPath } = resolveConfigPathForSync(id, detection, {
        allowCreateConfigIfMissing: true,
      })
      if (!configPath) {
        continue
      }

      const result = await syncService.sync(adapter, configPath)
      results.push(result)
    }

    return results
  })

  // ── clients:validate-config ───────────────────────────────────────────────
  ipcMain.handle(
    'clients:validate-config',
    async (_event, clientId: ClientId): Promise<ValidationResult> => {
      log.debug(`[ipc] clients:validate-config ${clientId}`)

      const adapter = ADAPTERS.get(clientId)
      if (!adapter) {
        return { valid: false, errors: [`Unknown client: ${clientId}`] }
      }

      const detection = await adapter.detect()
      if (!detection.installed || detection.configPaths.length === 0) {
        return {
          valid: false,
          errors: [`${adapter.displayName} is not installed or has no config file`],
        }
      }

      return adapter.validate(detection.configPaths[0]!)
    },
  )

  log.info('[ipc] clients handlers registered')
}
