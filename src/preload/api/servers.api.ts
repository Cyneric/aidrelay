import type { McpServer } from '../../shared/types'
import type {
  CreateServerInput,
  ImportResult,
  TestResult,
  UpdateServerInput,
} from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createServersApi = (ipcRenderer: IpcRendererLike) => ({
  serversList: (): Promise<McpServer[]> => ipcRenderer.invoke('servers:list'),
  serversGet: (id: string): Promise<McpServer | null> => ipcRenderer.invoke('servers:get', id),
  serversCreate: (input: CreateServerInput): Promise<McpServer> =>
    ipcRenderer.invoke('servers:create', input),
  serversUpdate: (id: string, updates: UpdateServerInput): Promise<McpServer> =>
    ipcRenderer.invoke('servers:update', id, updates),
  serversDelete: (id: string): Promise<void> => ipcRenderer.invoke('servers:delete', id),
  serversImportFromClients: (): Promise<ImportResult> =>
    ipcRenderer.invoke('servers:import-from-clients'),
  serversTest: (id: string): Promise<TestResult> => ipcRenderer.invoke('servers:test', id),
})
