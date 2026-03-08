import type { McpServer } from '../../shared/types'
import type { RegistryProvider, RegistryServer } from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createRegistryApi = (ipcRenderer: IpcRendererLike) => ({
  registrySearch: (provider: RegistryProvider, query: string): Promise<RegistryServer[]> =>
    ipcRenderer.invoke('registry:search', provider, query),
  registryInstall: (qualifiedName: string): Promise<McpServer> =>
    ipcRenderer.invoke('registry:install', qualifiedName),
})
