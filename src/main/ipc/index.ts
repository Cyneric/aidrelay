/**
 * @file src/main/ipc/index.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
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
import { registerRulesIpc } from './rules.ipc'
import { registerProfilesIpc } from './profiles.ipc'

/**
 * Registers all IPC handlers for every implemented domain.
 * Must be called after `app.whenReady()` resolves and before the window opens.
 */
export const registerIpcHandlers = (): void => {
  registerClientsIpc()
  registerServersIpc()
  registerLogIpc()
  registerRulesIpc()
  registerProfilesIpc()
  log.info('[ipc] all handlers registered')
}
