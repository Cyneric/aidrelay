import type {
  BackupEntry,
  BackupQueryFilters,
  BackupQueryResult,
  RestorePreviewResult,
} from '@shared/channels'
import type { ClientId } from '@shared/types'

export const backupsService = {
  list: (clientId: ClientId): Promise<BackupEntry[]> => window.api.backupsList(clientId),
  query: (filters: BackupQueryFilters): Promise<BackupQueryResult> =>
    window.api.backupsQuery(filters),
  previewRestore: (backupPath: string, clientId: ClientId): Promise<RestorePreviewResult> =>
    window.api.backupsPreviewRestore(backupPath, clientId),
  restore: (backupPath: string, clientId: ClientId): Promise<void> =>
    window.api.backupsRestore(backupPath, clientId),
}
