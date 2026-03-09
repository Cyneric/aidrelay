import type { IpcRendererLike } from './types'
import { createAppApi } from './app.api'
import { createBackupsApi } from './backups.api'
import { createClientsApi } from './clients.api'
import { createDialogApi } from './dialog.api'
import { createEventsApi } from './events.api'
import { createFilesApi } from './files.api'
import { createGitSyncApi } from './git-sync.api'
import { createLicenseApi } from './license.api'
import { createLogApi } from './log.api'
import { createProfilesApi } from './profiles.api'
import { createRegistryApi } from './registry.api'
import { createRulesApi } from './rules.api'
import { createSecretsApi } from './secrets.api'
import { createServersApi } from './servers.api'
import { createSettingsApi } from './settings.api'
import { createStacksApi } from './stacks.api'
import { createUpdaterApi } from './updater.api'
import { createWindowApi } from './window.api'

export const createApi = (ipcRenderer: IpcRendererLike) => ({
  ...createClientsApi(ipcRenderer),
  ...createServersApi(ipcRenderer),
  ...createRulesApi(ipcRenderer),
  ...createProfilesApi(ipcRenderer),
  ...createSecretsApi(ipcRenderer),
  ...createLicenseApi(ipcRenderer),
  ...createLogApi(ipcRenderer),
  ...createGitSyncApi(ipcRenderer),
  ...createRegistryApi(ipcRenderer),
  ...createStacksApi(ipcRenderer),
  ...createBackupsApi(ipcRenderer),
  ...createDialogApi(ipcRenderer),
  ...createFilesApi(ipcRenderer),
  ...createAppApi(ipcRenderer),
  ...createSettingsApi(ipcRenderer),
  ...createUpdaterApi(ipcRenderer),
  ...createWindowApi(ipcRenderer),
  ...createEventsApi(ipcRenderer),
})

export type ElectronApi = ReturnType<typeof createApi>
