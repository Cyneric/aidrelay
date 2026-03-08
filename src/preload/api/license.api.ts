import type { LicenseStatus } from '../../shared/types'
import type { FeatureGates } from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createLicenseApi = (ipcRenderer: IpcRendererLike) => ({
  licenseActivate: (key: string): Promise<LicenseStatus> =>
    ipcRenderer.invoke('license:activate', key),
  licenseDeactivate: (): Promise<void> => ipcRenderer.invoke('license:deactivate'),
  licenseStatus: (): Promise<LicenseStatus> => ipcRenderer.invoke('license:status'),
  licenseFeatureGates: (): Promise<FeatureGates> => ipcRenderer.invoke('license:feature-gates'),
})
