/**
 * @file src/main/ipc/secrets.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for the `secrets:*` channel namespace. Wires the
 * renderer to the keytar service for storing, retrieving, and deleting MCP
 * server environment variable secrets in the Windows Credential Manager.
 *
 * Secret values are never stored in SQLite — only key names are persisted
 * (as `secret_env_keys` on the server record). The actual values live
 * exclusively in the OS credential store.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import {
  storeSecret,
  getSecret,
  deleteSecret,
  listSecretKeys,
  deleteAllSecrets,
} from '@main/secrets/keytar.service'

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `secrets:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerSecretsIpc = (): void => {
  // ── secrets:set ───────────────────────────────────────────────────────────
  ipcMain.handle('secrets:set', async (_event, serverName: string, key: string, value: string) => {
    log.debug(`[ipc] secrets:set ${serverName}/${key}`)
    await storeSecret(serverName, key, value)
  })

  // ── secrets:get ───────────────────────────────────────────────────────────
  ipcMain.handle(
    'secrets:get',
    async (_event, serverName: string, key: string): Promise<string | null> => {
      log.debug(`[ipc] secrets:get ${serverName}/${key}`)
      return getSecret(serverName, key)
    },
  )

  // ── secrets:delete ────────────────────────────────────────────────────────
  ipcMain.handle('secrets:delete', async (_event, serverName: string, key: string) => {
    log.debug(`[ipc] secrets:delete ${serverName}/${key}`)
    await deleteSecret(serverName, key)
  })

  // ── secrets:list-keys ─────────────────────────────────────────────────────
  ipcMain.handle('secrets:list-keys', async (_event, serverName: string): Promise<string[]> => {
    log.debug(`[ipc] secrets:list-keys ${serverName}`)
    return listSecretKeys(serverName)
  })

  // ── secrets:delete-all ────────────────────────────────────────────────────
  ipcMain.handle('secrets:delete-all', async (_event, serverName: string) => {
    log.debug(`[ipc] secrets:delete-all ${serverName}`)
    await deleteAllSecrets(serverName)
  })

  log.info('[ipc] secrets handlers registered')
}
