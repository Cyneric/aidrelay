import type { BackupEntry } from '../../shared/channels'
import type { ClientId } from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createBackupsApi = (ipcRenderer: IpcRendererLike) => ({
  backupsList: (clientId: ClientId): Promise<BackupEntry[]> =>
    ipcRenderer.invoke('backups:list', clientId),
  backupsRestore: (backupPath: string, clientId: ClientId): Promise<void> =>
    ipcRenderer.invoke('backups:restore', backupPath, clientId),
})
