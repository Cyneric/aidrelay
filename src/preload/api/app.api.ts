import type { AppStartupStatus } from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createAppApi = (ipcRenderer: IpcRendererLike) => ({
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  appStartupStatus: (): Promise<AppStartupStatus> => ipcRenderer.invoke('app:startup-status'),
})
