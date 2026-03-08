import type {
  ClientId,
  ClientStatus,
  McpServerMap,
  SyncClientOptions,
  SyncResult,
  ValidationResult,
} from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createClientsApi = (ipcRenderer: IpcRendererLike) => ({
  clientsDetectAll: (): Promise<ClientStatus[]> => ipcRenderer.invoke('clients:detect-all'),
  clientsReadConfig: (clientId: ClientId): Promise<McpServerMap> =>
    ipcRenderer.invoke('clients:read-config', clientId),
  clientsSync: (clientId: ClientId, options?: SyncClientOptions): Promise<SyncResult> =>
    ipcRenderer.invoke('clients:sync', clientId, options),
  clientsSyncAll: (): Promise<SyncResult[]> => ipcRenderer.invoke('clients:sync-all'),
  clientsValidateConfig: (clientId: ClientId): Promise<ValidationResult> =>
    ipcRenderer.invoke('clients:validate-config', clientId),
})
