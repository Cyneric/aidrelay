import type {
  GitPullResult,
  GitPushResult,
  GitSyncStatus,
  ManualGitConfig,
} from '../../shared/types'
import type { IpcRendererLike } from './types'

export const createGitSyncApi = (ipcRenderer: IpcRendererLike) => ({
  gitSyncStatus: (): Promise<GitSyncStatus> => ipcRenderer.invoke('git-sync:status'),
  gitSyncConnectGitHub: (): Promise<GitSyncStatus> => ipcRenderer.invoke('git-sync:connect-github'),
  gitSyncConnectManual: (config: ManualGitConfig): Promise<GitSyncStatus> =>
    ipcRenderer.invoke('git-sync:connect-manual', config),
  gitSyncDisconnect: (): Promise<void> => ipcRenderer.invoke('git-sync:disconnect'),
  gitSyncPush: (): Promise<GitPushResult> => ipcRenderer.invoke('git-sync:push'),
  gitSyncPull: (): Promise<GitPullResult> => ipcRenderer.invoke('git-sync:pull'),
})
