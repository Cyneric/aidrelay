import type { IpcRendererLike } from './types'

export const createWindowApi = (ipcRenderer: IpcRendererLike) => ({
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  windowMaximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('window:close'),
})
