import type { IpcRendererLike } from './types'

export const createUpdaterApi = (ipcRenderer: IpcRendererLike) => ({
  updaterCheck: (): Promise<void> => ipcRenderer.invoke('updater:check'),
  updaterInstall: (): Promise<void> => ipcRenderer.invoke('updater:install'),
})
