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

export const clientsService = {
  detectAll: (): Promise<ClientStatus[]> => window.api.clientsDetectAll(),
  install: (clientId: ClientId): Promise<ClientInstallResult> =>
    window.api.clientsInstall(clientId),
  readConfig: (clientId: ClientId): Promise<McpServerMap> => window.api.clientsReadConfig(clientId),
  sync: (clientId: ClientId, options?: SyncClientOptions): Promise<SyncResult> =>
    window.api.clientsSync(clientId, options),
  syncAll: (): Promise<SyncResult[]> => window.api.clientsSyncAll(),
  previewSync: (clientId: ClientId, options?: SyncClientOptions): Promise<SyncPreviewResult> =>
    window.api.clientsPreviewSync(clientId, options),
  previewSyncAll: (): Promise<SyncAllPreviewResult> => window.api.clientsPreviewSyncAll(),
  previewConfigImport: (payload: ConfigChangedPayload): Promise<ConfigImportPreviewResult> =>
    window.api.clientsPreviewConfigImport(payload),
  importConfigChanges: (payload: ConfigChangedPayload): Promise<ConfigImportResult> =>
    window.api.clientsImportConfigChanges(payload),
  setManualConfigPath: (clientId: ClientId, path: string): Promise<ValidationResult> =>
    window.api.clientsSetManualConfigPath(clientId, path),
  clearManualConfigPath: (clientId: ClientId): Promise<void> =>
    window.api.clientsClearManualConfigPath(clientId),
  validateConfig: (clientId: ClientId): Promise<ValidationResult> =>
    window.api.clientsValidateConfig(clientId),
  onConfigChanged: (handler: (payload: ConfigChangedPayload) => void): (() => void) =>
    window.api.onConfigChanged(handler),
  onInstallProgress: (handler: (payload: ClientInstallProgressPayload) => void): (() => void) =>
    window.api.onClientInstallProgress(handler),
  onActivateProfileFromTray: (handler: (profileId: string) => void): (() => void) =>
    window.api.onActivateProfileFromTray(handler),
}
