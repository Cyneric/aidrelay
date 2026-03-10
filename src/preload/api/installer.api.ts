import type { InstallPlan, PreflightReport, DeviceSetupState } from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createInstallerApi = (ipcRenderer: IpcRendererLike) => ({
  installerPrepare: (serverId: string): Promise<InstallPlan> =>
    ipcRenderer.invoke('installer:prepare', serverId),

  installerPreflight: (serverId: string): Promise<PreflightReport> =>
    ipcRenderer.invoke('installer:preflight', serverId),

  installerRun: (serverId: string): Promise<void> => ipcRenderer.invoke('installer:run', serverId),

  installerCancel: (serverId: string): Promise<void> =>
    ipcRenderer.invoke('installer:cancel', serverId),

  installerStatus: (serverId: string): Promise<DeviceSetupState | null> =>
    ipcRenderer.invoke('installer:status', serverId),

  installerRepair: (serverId: string): Promise<InstallPlan> =>
    ipcRenderer.invoke('installer:repair', serverId),
})
