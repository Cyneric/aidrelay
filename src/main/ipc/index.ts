/**
 * @file src/main/ipc/index.ts
 *
 * @created 07.03.2026
 * @modified 11.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Aggregates all IPC handler registration functions and exposes a
 * single `registerIpcHandlers()` call for `src/main/index.ts` to invoke inside
 * `app.whenReady()`. Add new domain registration calls here as each feature
 * is implemented in subsequent phases.
 */

import log from 'electron-log'
import { registerClientsIpc } from './clients.ipc'
import { registerServersIpc } from './servers.ipc'
import { registerLogIpc } from './log.ipc'
import { registerDiagnosticsIpc } from './diagnostics.ipc'
import { registerRulesIpc } from './rules.ipc'
import { registerProfilesIpc } from './profiles.ipc'
import { registerSecretsIpc } from './secrets.ipc'
import { registerLicenseIpc } from './license.ipc'
import { registerGitSyncIpc } from './git-sync.ipc'
import { registerSyncIpc } from './sync.ipc'
import { registerRegistryIpc } from './registry.ipc'
import { registerInstallerIpc } from './installer.ipc'
import { registerStacksIpc } from './stacks.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerBackupsIpc } from './backups.ipc'
import { registerUpdaterIpc } from './updater.ipc'
import { registerDialogIpc } from './dialog.ipc'
import { registerAppIpc } from './app.ipc'
import { registerWindowIpc } from './window.ipc'
import { registerFilesIpc } from './files.ipc'
import { registerSkillsIpc } from './skills.ipc'

/**
 * Registers all IPC handlers for every implemented domain.
 * Must be called after `app.whenReady()` resolves and before the window opens.
 */
export const registerIpcHandlers = (): void => {
  registerClientsIpc()
  registerServersIpc()
  registerSecretsIpc()
  registerLogIpc()
  registerDiagnosticsIpc()
  registerRulesIpc()
  registerProfilesIpc()
  registerLicenseIpc()
  registerGitSyncIpc()
  registerSyncIpc()
  registerRegistryIpc()
  registerInstallerIpc()
  registerSkillsIpc()
  registerStacksIpc()
  registerSettingsIpc()
  registerBackupsIpc()
  registerUpdaterIpc()
  registerDialogIpc()
  registerFilesIpc()
  registerAppIpc()
  registerWindowIpc()
  log.info('[ipc] all handlers registered')
}
