/**
 * @file src/main/ipc/clients.ipc.ts
 *
 * @description IPC handlers for all client-related channels.
 */

import { existsSync } from 'fs'
import { ipcMain } from 'electron'
import log from 'electron-log'
import { join } from 'path'
import type {
  ClientId,
  ClientInstallResult,
  ClientStatus,
  ConfigChangedPayload,
  ConfigImportPreviewResult,
  ConfigImportResult,
  McpServerMap,
  SyncClientOptions,
  SyncResult,
  SyncPreviewResult,
  SyncAllPreviewResult,
  ValidationResult,
} from '@shared/types'
import type { ClientInstallProgressPayload } from '@shared/channels'
import { ADAPTERS, ADAPTER_IDS } from '@main/clients/registry'
import type { ClientAdapter } from '@main/clients/types'
import { ClientInstallService } from '@main/clients/client-install.service'
import {
  importExternalConfigChanges,
  previewExternalConfigImport,
  resolveAdapterForPayload,
} from '@main/clients/config-import.service'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { BackupsRepo } from '@main/db/backups.repo'
import { SettingsRepo } from '@main/db/settings.repo'
import { BackupService } from '@main/sync/backup.service'
import { SyncService } from '@main/sync/sync.service'
import { VISUAL_STUDIO_CONFIG_SETTING_KEY } from '@main/clients/visual-studio.adapter'

const MANUAL_CONFIG_PATH_PREFIX = 'clients.manualConfigPath.'

// ─── Service Factory ──────────────────────────────────────────────────────────

const createSyncService = (): SyncService => {
  const db = getDatabase()
  const serversRepo = new ServersRepo(db)
  const activityLogRepo = new ActivityLogRepo(db)
  const backupsRepo = new BackupsRepo(db)
  const backupService = new BackupService(backupsRepo)
  return new SyncService(serversRepo, activityLogRepo, backupService)
}

const settingsRepo = (): SettingsRepo => new SettingsRepo(getDatabase())

const supportsManualConfigPath = (clientId: ClientId): boolean => clientId !== 'jetbrains'

const manualConfigPathSettingKey = (clientId: ClientId): string =>
  `${MANUAL_CONFIG_PATH_PREFIX}${clientId}`

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const getStoredManualConfigPath = (clientId: ClientId): string | undefined => {
  if (!supportsManualConfigPath(clientId)) return undefined

  const repo = settingsRepo()
  const current = asNonEmptyString(repo.get<string>(manualConfigPathSettingKey(clientId)))
  if (current) return current

  if (clientId === 'visual-studio') {
    return asNonEmptyString(repo.get<string>(VISUAL_STUDIO_CONFIG_SETTING_KEY))
  }

  return undefined
}

const setStoredManualConfigPath = (clientId: ClientId, configPath: string): void => {
  if (!supportsManualConfigPath(clientId)) return
  const repo = settingsRepo()
  repo.set(manualConfigPathSettingKey(clientId), configPath)
  if (clientId === 'visual-studio') {
    repo.set(VISUAL_STUDIO_CONFIG_SETTING_KEY, configPath)
  }
}

const clearStoredManualConfigPath = (clientId: ClientId): void => {
  if (!supportsManualConfigPath(clientId)) return
  const repo = settingsRepo()
  repo.delete(manualConfigPathSettingKey(clientId))
  if (clientId === 'visual-studio') {
    repo.delete(VISUAL_STUDIO_CONFIG_SETTING_KEY)
  }
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
    case 'gemini-cli': {
      const userProfile = process.env['USERPROFILE'] ?? ''
      return userProfile ? join(userProfile, '.gemini', 'settings.json') : null
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
      const appData = process.env['APPDATA'] ?? ''
      const userProfile = process.env['USERPROFILE'] ?? ''
      const candidates = [
        appData ? join(appData, 'VisualStudio', 'mcp.json') : null,
        appData ? join(appData, 'Microsoft', 'VisualStudio', 'mcp.json') : null,
        userProfile ? join(userProfile, 'Documents', 'Visual Studio 2022', 'mcp.json') : null,
      ]
      return (
        candidates.find((path): path is string => typeof path === 'string' && path.length > 0) ??
        null
      )
    }
    default:
      return null
  }
}

const resolveClientDetection = async (
  clientId: ClientId,
  adapter: ClientAdapter,
): Promise<{
  detection: { installed: boolean; configPaths: readonly string[]; serverCount: number }
  manualConfigPath?: string
}> => {
  const detection = await adapter.detect()
  const manualConfigPath = getStoredManualConfigPath(clientId)

  if (!manualConfigPath) {
    return { detection }
  }

  if (existsSync(manualConfigPath)) {
    let serverCount = 0
    try {
      const servers = await adapter.read(manualConfigPath)
      serverCount = Object.keys(servers).length
    } catch {
      // Keep serverCount at 0 for malformed files; validate() reports details.
    }

    return {
      manualConfigPath,
      detection: {
        ...detection,
        installed: true,
        configPaths: [manualConfigPath],
        serverCount,
      },
    }
  }

  return {
    manualConfigPath,
    detection: {
      ...detection,
      configPaths: [],
      serverCount: 0,
    },
  }
}

const resolveConfigPathForSync = (
  clientId: ClientId,
  detection: { installed: boolean; configPaths: readonly string[] },
  manualConfigPath: string | undefined,
  options?: SyncClientOptions,
): { configPath: string | null; requiresConfigCreationConfirm: boolean } => {
  if (manualConfigPath) {
    if (detection.configPaths.length > 0) {
      return { configPath: detection.configPaths[0]!, requiresConfigCreationConfirm: false }
    }
    if (options?.allowCreateConfigIfMissing === true) {
      return { configPath: manualConfigPath, requiresConfigCreationConfirm: false }
    }
    return { configPath: null, requiresConfigCreationConfirm: true }
  }

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

export const registerClientsIpc = (): void => {
  const installService = new ClientInstallService()

  ipcMain.handle('clients:detect-all', async (): Promise<ClientStatus[]> => {
    log.debug('[ipc] clients:detect-all')

    const db = getDatabase()
    const activityLogRepo = new ActivityLogRepo(db)

    const results = await Promise.all(
      ADAPTER_IDS.map(async (id): Promise<ClientStatus> => {
        const adapter = ADAPTERS.get(id)!
        try {
          const { detection, manualConfigPath } = await resolveClientDetection(id, adapter)
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
            ...(manualConfigPath ? { manualConfigPath } : {}),
          }
        } catch (err) {
          const manualConfigPath = getStoredManualConfigPath(id)
          log.warn(`[ipc] detect failed for ${id}: ${String(err)}`)
          return {
            id,
            displayName: adapter.displayName,
            installed: false,
            configPaths: [],
            serverCount: 0,
            syncStatus: 'error',
            ...(manualConfigPath ? { manualConfigPath } : {}),
          }
        }
      }),
    )

    return results
  })

  ipcMain.handle(
    'clients:install',
    async (event, clientId: ClientId): Promise<ClientInstallResult> => {
      log.debug(`[ipc] clients:install ${clientId}`)
      return installService.install(clientId, (payload: ClientInstallProgressPayload) => {
        event.sender.send('clients:install-progress', payload)
      })
    },
  )

  ipcMain.handle(
    'clients:set-manual-config-path',
    async (_event, clientId: ClientId, configPath: string): Promise<ValidationResult> => {
      log.debug(`[ipc] clients:set-manual-config-path ${clientId}`)

      if (!supportsManualConfigPath(clientId)) {
        return {
          valid: false,
          errors: [`Manual config discovery is not supported for ${clientId}`],
        }
      }

      const adapter = ADAPTERS.get(clientId)
      if (!adapter) {
        return { valid: false, errors: [`Unknown client: ${clientId}`] }
      }

      const normalized = configPath.trim()
      if (normalized.length === 0) {
        return { valid: false, errors: ['Config path is required'] }
      }

      const validation = await adapter.validate(normalized)
      if (!validation.valid) {
        return validation
      }

      setStoredManualConfigPath(clientId, normalized)
      return validation
    },
  )

  ipcMain.handle('clients:clear-manual-config-path', (_event, clientId: ClientId): void => {
    log.debug(`[ipc] clients:clear-manual-config-path ${clientId}`)
    clearStoredManualConfigPath(clientId)
  })

  ipcMain.handle(
    'clients:read-config',
    async (_event, clientId: ClientId): Promise<McpServerMap> => {
      log.debug(`[ipc] clients:read-config ${clientId}`)

      const adapter = ADAPTERS.get(clientId)
      if (!adapter) return {}

      const { detection } = await resolveClientDetection(clientId, adapter)
      if (!detection.installed || detection.configPaths.length === 0) return {}

      return adapter.read(detection.configPaths[0]!)
    },
  )

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

      const { detection, manualConfigPath } = await resolveClientDetection(clientId, adapter)
      const { configPath, requiresConfigCreationConfirm } = resolveConfigPathForSync(
        clientId,
        detection,
        manualConfigPath,
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

  ipcMain.handle(
    'clients:preview-sync',
    async (_event, clientId: ClientId, options?: SyncClientOptions): Promise<SyncPreviewResult> => {
      log.debug(`[ipc] clients:preview-sync ${clientId}`)

      const adapter = ADAPTERS.get(clientId)
      if (!adapter) {
        throw new Error(`No adapter registered for client: ${clientId}`)
      }

      const { detection, manualConfigPath } = await resolveClientDetection(clientId, adapter)
      const { configPath, requiresConfigCreationConfirm } = resolveConfigPathForSync(
        clientId,
        detection,
        manualConfigPath,
        options,
      )

      if (requiresConfigCreationConfirm) {
        throw Object.assign(
          new Error(`${adapter.displayName} has no config file yet. Confirm to create one.`),
          { errorCode: 'config_creation_required' as const },
        )
      }
      if (!configPath) {
        throw new Error(`${adapter.displayName} is not installed or has no config file`)
      }

      const syncService = createSyncService()
      return syncService.previewSync(adapter, configPath)
    },
  )

  ipcMain.handle('clients:preview-sync-all', async (): Promise<SyncAllPreviewResult> => {
    log.debug('[ipc] clients:preview-sync-all')

    const syncService = createSyncService()
    const previews: Partial<Record<ClientId, SyncPreviewResult>> = {}

    for (const id of ADAPTER_IDS) {
      const adapter = ADAPTERS.get(id)!
      const { detection, manualConfigPath } = await resolveClientDetection(id, adapter)
      const { configPath } = resolveConfigPathForSync(id, detection, manualConfigPath, {
        allowCreateConfigIfMissing: true,
      })
      if (!configPath) {
        continue
      }

      try {
        const preview = await syncService.previewSync(adapter, configPath)
        previews[id] = preview
      } catch (error) {
        log.error(`[ipc] preview sync failed for ${id}:`, error)
        // skip failing client
      }
    }

    return { previews }
  })

  ipcMain.handle('clients:sync-all', async (): Promise<SyncResult[]> => {
    log.debug('[ipc] clients:sync-all')

    const syncService = createSyncService()
    const results: SyncResult[] = []

    for (const id of ADAPTER_IDS) {
      const adapter = ADAPTERS.get(id)!
      const { detection, manualConfigPath } = await resolveClientDetection(id, adapter)
      const { configPath } = resolveConfigPathForSync(id, detection, manualConfigPath, {
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

  ipcMain.handle(
    'clients:preview-config-import',
    async (_event, payload: ConfigChangedPayload): Promise<ConfigImportPreviewResult> => {
      log.debug(`[ipc] clients:preview-config-import ${payload.clientId}`)

      const adapter = resolveAdapterForPayload(payload, ADAPTERS)
      if (!adapter) {
        throw new Error(`No adapter registered for client: ${payload.clientId}`)
      }

      const db = getDatabase()
      const serversRepo = new ServersRepo(db)
      return previewExternalConfigImport(adapter, payload, serversRepo)
    },
  )

  ipcMain.handle(
    'clients:import-config-changes',
    async (_event, payload: ConfigChangedPayload): Promise<ConfigImportResult> => {
      log.debug(`[ipc] clients:import-config-changes ${payload.clientId}`)

      const adapter = resolveAdapterForPayload(payload, ADAPTERS)
      if (!adapter) {
        throw new Error(`No adapter registered for client: ${payload.clientId}`)
      }

      const db = getDatabase()
      const serversRepo = new ServersRepo(db)
      return importExternalConfigChanges(adapter, payload, serversRepo)
    },
  )

  ipcMain.handle(
    'clients:validate-config',
    async (_event, clientId: ClientId): Promise<ValidationResult> => {
      log.debug(`[ipc] clients:validate-config ${clientId}`)

      const adapter = ADAPTERS.get(clientId)
      if (!adapter) {
        return { valid: false, errors: [`Unknown client: ${clientId}`] }
      }

      const { detection } = await resolveClientDetection(clientId, adapter)
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
