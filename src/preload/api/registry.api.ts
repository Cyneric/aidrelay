import type { McpServer } from '../../shared/types'
import type {
  RegistryInstallPlan,
  RegistryInstallRequest,
  RegistryProvider,
  RegistryServer,
} from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createRegistryApi = (ipcRenderer: IpcRendererLike) => ({
  registrySearch: (provider: RegistryProvider, query: string): Promise<RegistryServer[]> =>
    ipcRenderer.invoke('registry:search', provider, query),
  registryPrepareInstall: (
    provider: RegistryProvider,
    serverId: string,
  ): Promise<RegistryInstallPlan> =>
    ipcRenderer.invoke('registry:prepare-install', provider, serverId),
  registryInstall: (request: RegistryInstallRequest): Promise<McpServer> =>
    ipcRenderer.invoke('registry:install', request),
})
