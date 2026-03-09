import type {
  AppStartupCompletePayload,
  AppStartupProgressPayload,
  ClientInstallProgressPayload,
  WindowMaximizeChangedPayload,
} from '../../shared/channels'
import type { ConfigChangedPayload } from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createEventsApi = (ipcRenderer: IpcRendererLike) => ({
  onConfigChanged: (handler: (payload: ConfigChangedPayload) => void): (() => void) => {
    const wrapped = (...args: unknown[]) => {
      handler(args[1] as ConfigChangedPayload)
    }
    ipcRenderer.on('clients:config-changed', wrapped)
    return () => ipcRenderer.removeListener('clients:config-changed', wrapped)
  },

  onClientInstallProgress: (
    handler: (payload: ClientInstallProgressPayload) => void,
  ): (() => void) => {
    const wrapped = (...args: unknown[]) => {
      handler(args[1] as ClientInstallProgressPayload)
    }
    ipcRenderer.on('clients:install-progress', wrapped)
    return () => ipcRenderer.removeListener('clients:install-progress', wrapped)
  },

  onActivateProfileFromTray: (handler: (profileId: string) => void): (() => void) => {
    const wrapped = (...args: unknown[]) => {
      handler(args[1] as string)
    }
    ipcRenderer.on('profiles:activate-from-tray', wrapped)
    return () => ipcRenderer.removeListener('profiles:activate-from-tray', wrapped)
  },

  onUpdateAvailable: (handler: (info: { version: string }) => void): (() => void) => {
    const wrapped = (...args: unknown[]) => {
      handler(args[1] as { version: string })
    }
    ipcRenderer.on('updater:update-available', wrapped)
    return () => ipcRenderer.removeListener('updater:update-available', wrapped)
  },

  onUpdateDownloaded: (handler: (info: { version: string }) => void): (() => void) => {
    const wrapped = (...args: unknown[]) => {
      handler(args[1] as { version: string })
    }
    ipcRenderer.on('updater:update-downloaded', wrapped)
    return () => ipcRenderer.removeListener('updater:update-downloaded', wrapped)
  },

  onMaximizeChanged: (handler: (payload: WindowMaximizeChangedPayload) => void): (() => void) => {
    const wrapped = (...args: unknown[]) => {
      handler(args[1] as WindowMaximizeChangedPayload)
    }
    ipcRenderer.on('window:maximize-changed', wrapped)
    return () => ipcRenderer.removeListener('window:maximize-changed', wrapped)
  },

  onStartupProgress: (handler: (payload: AppStartupProgressPayload) => void): (() => void) => {
    const wrapped = (...args: unknown[]) => {
      handler(args[1] as AppStartupProgressPayload)
    }
    ipcRenderer.on('app:startup-progress', wrapped)
    return () => ipcRenderer.removeListener('app:startup-progress', wrapped)
  },

  onStartupComplete: (handler: (payload: AppStartupCompletePayload) => void): (() => void) => {
    const wrapped = (...args: unknown[]) => {
      handler(args[1] as AppStartupCompletePayload)
    }
    ipcRenderer.on('app:startup-complete', wrapped)
    return () => ipcRenderer.removeListener('app:startup-complete', wrapped)
  },
})
