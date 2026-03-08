import type { IpcRendererLike } from './types'

export const createSecretsApi = (ipcRenderer: IpcRendererLike) => ({
  secretsSet: (serverName: string, key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('secrets:set', serverName, key, value),
  secretsGet: (serverName: string, key: string): Promise<string | null> =>
    ipcRenderer.invoke('secrets:get', serverName, key),
  secretsDelete: (serverName: string, key: string): Promise<void> =>
    ipcRenderer.invoke('secrets:delete', serverName, key),
  secretsListKeys: (serverName: string): Promise<string[]> =>
    ipcRenderer.invoke('secrets:list-keys', serverName),
  secretsDeleteAll: (serverName: string): Promise<void> =>
    ipcRenderer.invoke('secrets:delete-all', serverName),
})
