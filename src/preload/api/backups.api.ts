import type {
  BackupEntry,
  BackupQueryFilters,
  BackupQueryResult,
  RestorePreviewResult,
} from '../../shared/channels'
import type { ClientId } from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createBackupsApi = (ipcRenderer: IpcRendererLike) => ({
  backupsList: (clientId: ClientId): Promise<BackupEntry[]> =>
    ipcRenderer.invoke('backups:list', clientId),
  backupsQuery: (filters: BackupQueryFilters): Promise<BackupQueryResult> =>
    ipcRenderer.invoke('backups:query', filters),
  backupsPreviewRestore: (backupPath: string, clientId: ClientId): Promise<RestorePreviewResult> =>
    ipcRenderer.invoke('backups:preview-restore', backupPath, clientId),
  backupsRestore: (backupPath: string, clientId: ClientId): Promise<void> =>
    ipcRenderer.invoke('backups:restore', backupPath, clientId),
})
