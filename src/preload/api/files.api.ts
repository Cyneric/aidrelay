import type { ReadTextFileResult, WriteTextFileResult } from '@shared/channels'
import type { IpcRendererLike } from './types'

export const createFilesApi = (ipcRenderer: IpcRendererLike) => ({
  filesReveal: (path: string): Promise<void> => ipcRenderer.invoke('files:reveal', path),
  filesReadText: (path: string): Promise<ReadTextFileResult> =>
    ipcRenderer.invoke('files:read-text', path),
  filesWriteText: (
    path: string,
    content: string,
    expectedMtimeMs: number,
  ): Promise<WriteTextFileResult> =>
    ipcRenderer.invoke('files:write-text', path, content, expectedMtimeMs),
})
