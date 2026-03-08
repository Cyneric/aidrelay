import type { ActivityLogEntry, LogFilters } from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createLogApi = (ipcRenderer: IpcRendererLike) => ({
  logQuery: (filters: LogFilters): Promise<ActivityLogEntry[]> =>
    ipcRenderer.invoke('log:query', filters),
})
