import type { ImportResult } from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createStacksApi = (ipcRenderer: IpcRendererLike) => ({
  stacksExport: (serverIds: string[], ruleIds: string[], name: string): Promise<string> =>
    ipcRenderer.invoke('stacks:export', serverIds, ruleIds, name),
  stacksImport: (json: string): Promise<ImportResult> => ipcRenderer.invoke('stacks:import', json),
})
