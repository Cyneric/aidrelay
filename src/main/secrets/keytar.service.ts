/**
 * @file src/main/secrets/keytar.service.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Thin wrapper around the `keytar` native module for storing
 * and retrieving MCP server environment variable secrets using the Windows
 * Credential Manager. All secrets are scoped to the `aidrelay` service name
 * and keyed as `{serverName}/{envKey}` so they can be enumerated per server.
 *
 * The service is stateless — every call goes directly to the OS credential
 * store, so there is never stale data cached in memory.
 */

import keytar from 'keytar'

/** Service namespace used for all keytar credentials. */
const SERVICE = 'aidrelay'

/**
 * Builds the credential account key from a server name and environment key.
 *
 * @param serverName - The name of the MCP server.
 * @param envKey     - The environment variable key name.
 * @returns The composite account string used in Windows Credential Manager.
 */
const buildAccount = (serverName: string, envKey: string): string => `${serverName}/${envKey}`

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Stores or updates a secret in the Windows Credential Manager.
 * If a credential with the same server name and key already exists it is
 * silently overwritten.
 *
 * @param serverName - The MCP server this secret belongs to.
 * @param envKey     - The environment variable key name.
 * @param value      - The plaintext secret value to store.
 */
export const storeSecret = (serverName: string, envKey: string, value: string): Promise<void> =>
  keytar.setPassword(SERVICE, buildAccount(serverName, envKey), value)

/**
 * Retrieves a secret from the Windows Credential Manager.
 *
 * @param serverName - The MCP server this secret belongs to.
 * @param envKey     - The environment variable key name.
 * @returns The stored plaintext value, or `null` if no matching credential
 *   exists (e.g. it was deleted externally).
 */
export const getSecret = (serverName: string, envKey: string): Promise<string | null> =>
  keytar.getPassword(SERVICE, buildAccount(serverName, envKey))

/**
 * Removes a secret from the Windows Credential Manager.
 * This is a no-op (and does not throw) if the credential does not exist.
 *
 * @param serverName - The MCP server this secret belongs to.
 * @param envKey     - The environment variable key name.
 * @returns `true` if the credential was found and deleted, `false` otherwise.
 */
export const deleteSecret = (serverName: string, envKey: string): Promise<boolean> =>
  keytar.deletePassword(SERVICE, buildAccount(serverName, envKey))

/**
 * Lists all secret env key names stored for a given MCP server.
 * Reads from the Windows Credential Manager and strips the server name prefix
 * so callers receive plain key names like `['API_KEY', 'TOKEN']`.
 *
 * @param serverName - The MCP server to list secrets for.
 * @returns Array of env key names that have credentials stored.
 */
export const listSecretKeys = async (serverName: string): Promise<string[]> => {
  const credentials = await keytar.findCredentials(SERVICE)
  const prefix = `${serverName}/`
  return credentials
    .filter((c) => c.account.startsWith(prefix))
    .map((c) => c.account.slice(prefix.length))
}

/**
 * Removes all secrets stored for a given MCP server.
 * Called when the server is deleted from the registry so no orphaned
 * credentials are left behind in Windows Credential Manager.
 *
 * @param serverName - The MCP server whose secrets should all be removed.
 */
export const deleteAllSecrets = async (serverName: string): Promise<void> => {
  const keys = await listSecretKeys(serverName)
  await Promise.all(keys.map((key) => deleteSecret(serverName, key)))
}

/**
 * Removes every credential stored by aidrelay in the OS credential store.
 * Used by factory reset to return to a first-install state.
 */
export const deleteAllServiceSecrets = async (): Promise<void> => {
  const credentials = await keytar.findCredentials(SERVICE)
  await Promise.all(credentials.map((cred) => keytar.deletePassword(SERVICE, cred.account)))
}
