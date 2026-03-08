import type { Profile, SyncResult } from '@shared/types'
import type { CreateProfileInput, UpdateProfileInput } from '@shared/channels'

export const profilesService = {
  list: (): Promise<Profile[]> => window.api.profilesList(),
  create: (input: CreateProfileInput): Promise<Profile> => window.api.profilesCreate(input),
  update: (id: string, updates: UpdateProfileInput): Promise<Profile> =>
    window.api.profilesUpdate(id, updates),
  remove: (id: string): Promise<void> => window.api.profilesDelete(id),
  activate: (id: string): Promise<SyncResult[]> => window.api.profilesActivate(id),
}
