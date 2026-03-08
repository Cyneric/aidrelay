import type { SettingsResetInput, SettingsResetResult } from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createSettingsApi = (ipcRenderer: IpcRendererLike) => ({
  settingsGet: (key: string): Promise<unknown> => ipcRenderer.invoke('settings:get', key),
  settingsSet: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),
  settingsDelete: (key: string): Promise<void> => ipcRenderer.invoke('settings:delete', key),
  settingsReset: (input: SettingsResetInput): Promise<SettingsResetResult> =>
    ipcRenderer.invoke('settings:reset', input),
})
