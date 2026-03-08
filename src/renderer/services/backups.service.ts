import type { BackupEntry } from '@shared/channels'
import type { ClientId } from '@shared/types'

export const backupsService = {
  list: (clientId: ClientId): Promise<BackupEntry[]> => window.api.backupsList(clientId),
  restore: (backupPath: string, clientId: ClientId): Promise<void> =>
    window.api.backupsRestore(backupPath, clientId),
}
