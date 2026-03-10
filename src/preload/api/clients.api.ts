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
  ValidationResultByClientId,
} from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createClientsApi = (ipcRenderer: IpcRendererLike) => ({
  clientsDetectAll: (): Promise<ClientStatus[]> => ipcRenderer.invoke('clients:detect-all'),
  clientsInstall: (clientId: ClientId): Promise<ClientInstallResult> =>
    ipcRenderer.invoke('clients:install', clientId),
  clientsReadConfig: (clientId: ClientId): Promise<McpServerMap> =>
    ipcRenderer.invoke('clients:read-config', clientId),
  clientsSync: (clientId: ClientId, options?: SyncClientOptions): Promise<SyncResult> =>
    ipcRenderer.invoke('clients:sync', clientId, options),
  clientsSyncAll: (): Promise<SyncResult[]> => ipcRenderer.invoke('clients:sync-all'),
  clientsPreviewConfigImport: (payload: ConfigChangedPayload): Promise<ConfigImportPreviewResult> =>
    ipcRenderer.invoke('clients:preview-config-import', payload),
  clientsPreviewSync: (
    clientId: ClientId,
    options?: SyncClientOptions,
  ): Promise<SyncPreviewResult> => ipcRenderer.invoke('clients:preview-sync', clientId, options),
  clientsPreviewSyncAll: (): Promise<SyncAllPreviewResult> =>
    ipcRenderer.invoke('clients:preview-sync-all'),
  clientsImportConfigChanges: (payload: ConfigChangedPayload): Promise<ConfigImportResult> =>
    ipcRenderer.invoke('clients:import-config-changes', payload),
  clientsSetManualConfigPath: (clientId: ClientId, path: string): Promise<ValidationResult> =>
    ipcRenderer.invoke('clients:set-manual-config-path', clientId, path),
  clientsClearManualConfigPath: (clientId: ClientId): Promise<void> =>
    ipcRenderer.invoke('clients:clear-manual-config-path', clientId),
  clientsValidateConfig: (clientId: ClientId): Promise<ValidationResult> =>
    ipcRenderer.invoke('clients:validate-config', clientId),
  clientsValidateAllConfigs: (): Promise<ValidationResultByClientId> =>
    ipcRenderer.invoke('clients:validate-all-configs'),
})
