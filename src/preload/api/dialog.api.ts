import type { IpcRendererLike } from './types'

export const createDialogApi = (ipcRenderer: IpcRendererLike) => ({
  showOpenDialog: (options?: {
    properties?: readonly ('openDirectory' | 'openFile' | 'multiSelections')[]
    title?: string
  }): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('dialog:show-open', options ?? {}),
})
