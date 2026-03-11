import type { PendingSetup, SyncConflict } from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createSyncApi = (ipcRenderer: IpcRendererLike) => ({
  syncListPending: (): Promise<PendingSetup[]> => ipcRenderer.invoke('sync:list-pending'),

  syncApplyPending: (serverId: string): Promise<void> =>
    ipcRenderer.invoke('sync:apply-pending', serverId),

  syncAutoPull: (): Promise<void> => ipcRenderer.invoke('sync:auto-pull'),

  syncListConflicts: (): Promise<SyncConflict[]> => ipcRenderer.invoke('sync:list-conflicts'),

  syncResolveConflict: (conflictId: string, resolution: 'local' | 'remote'): Promise<void> =>
    ipcRenderer.invoke('sync:resolve-conflict', conflictId, resolution),

  syncPushReview: (): Promise<SyncConflict[]> => ipcRenderer.invoke('sync:push-review'),
})
