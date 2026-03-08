import type { Profile, SyncResult } from '../../shared/types'
import type { CreateProfileInput, UpdateProfileInput } from '../../shared/channels'
import type { IpcRendererLike } from './types'

export const createProfilesApi = (ipcRenderer: IpcRendererLike) => ({
  profilesList: (): Promise<Profile[]> => ipcRenderer.invoke('profiles:list'),
  profilesGet: (id: string): Promise<Profile | null> => ipcRenderer.invoke('profiles:get', id),
  profilesCreate: (input: CreateProfileInput): Promise<Profile> =>
    ipcRenderer.invoke('profiles:create', input),
  profilesUpdate: (id: string, updates: UpdateProfileInput): Promise<Profile> =>
    ipcRenderer.invoke('profiles:update', id, updates),
  profilesDelete: (id: string): Promise<void> => ipcRenderer.invoke('profiles:delete', id),
  profilesActivate: (id: string): Promise<SyncResult[]> =>
    ipcRenderer.invoke('profiles:activate', id),
})
