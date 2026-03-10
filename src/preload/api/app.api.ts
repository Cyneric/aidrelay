import type { AppStartupStatus } from '../../shared/channels'
import type { OssAttribution } from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createAppApi = (ipcRenderer: IpcRendererLike) => ({
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  appStartupStatus: (): Promise<AppStartupStatus> => ipcRenderer.invoke('app:startup-status'),
  appOssAttributions: (): Promise<OssAttribution[]> => ipcRenderer.invoke('app:oss-attributions'),
})
