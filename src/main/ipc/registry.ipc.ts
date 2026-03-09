/**
 * @file src/main/ipc/registry.ipc.ts
 *
 * @created 07.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for the registry domain. Browsing (search) is
 * available on the free tier. Install now follows a two-step prepare/install
 * contract so the renderer can enforce explicit review before creation.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { McpServer } from '@shared/types'
import type {
  RegistryInstallPlan,
  RegistryInstallRequest,
  RegistryProvider,
  RegistryServer,
} from '@shared/channels'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { checkGate } from '@main/licensing/feature-gates'
import { storeSecret } from '@main/secrets/keytar.service'
import { toSecretHeaderAccountKey } from '@main/secrets/secret-keys'
import { prepareRegistryInstallPlan, searchRegistry } from '@main/registry/providers'
import { resolveRegistryInstallRequest } from '@main/registry/install-resolver'

// ─── Service Factory ──────────────────────────────────────────────────────────

const createRepos = (): { servers: ServersRepo; log: ActivityLogRepo } => {
  const db = getDatabase()
  return { servers: new ServersRepo(db), log: new ActivityLogRepo(db) }
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `registry:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerRegistryIpc = (): void => {
  // ── registry:search ─────────────────────────────────────────────────────
  ipcMain.handle(
    'registry:search',
    async (_event, provider: RegistryProvider, query: string): Promise<RegistryServer[]> => {
      log.debug(`[ipc] registry:search provider="${provider}" query="${query}"`)
      return searchRegistry(provider, query)
    },
  )

  // ── registry:prepare-install ───────────────────────────────────────────
  ipcMain.handle(
    'registry:prepare-install',
    async (_event, provider: RegistryProvider, serverId: string): Promise<RegistryInstallPlan> => {
      log.debug(`[ipc] registry:prepare-install provider="${provider}" server="${serverId}"`)
      return prepareRegistryInstallPlan(provider, serverId)
    },
  )

  // ── registry:install ────────────────────────────────────────────────────
  ipcMain.handle(
    'registry:install',
    async (_event, request: RegistryInstallRequest): Promise<McpServer> => {
      log.debug(
        `[ipc] registry:install provider="${request.provider}" server="${request.serverId}" option="${request.optionId}"`,
      )

      // Install can be tier-gated by config (enabled for Free in current plan).
      const allowed = checkGate('registryInstall')
      if (!allowed) {
        return Promise.reject(new Error('Registry install requires aidrelay Pro.'))
      }

      const { servers, log: logRepo } = createRepos()

      // Enforce the per-tier server limit.
      const maxServers = checkGate('maxServers')
      const currentCount = servers.findAll().length
      if (currentCount >= maxServers) {
        return Promise.reject(
          new Error(
            `Server limit reached (${maxServers}). Upgrade to aidrelay Pro for unlimited servers.`,
          ),
        )
      }

      const plan = await prepareRegistryInstallPlan(request.provider, request.serverId)
      const resolved = resolveRegistryInstallRequest(plan, request)
      const server = servers.create(resolved.createInput)

      try {
        await Promise.all([
          ...Object.entries(resolved.secretEnvValues).map(([key, value]) =>
            storeSecret(server.name, key, value),
          ),
          ...Object.entries(resolved.secretHeaderValues).map(([key, value]) =>
            storeSecret(server.name, toSecretHeaderAccountKey(key), value),
          ),
        ])
      } catch (err) {
        // Keep creation + secret writes atomic from the user's perspective.
        servers.delete(server.id)
        throw err
      }

      logRepo.insert({
        action: 'registry.installed',
        details: {
          provider: request.provider,
          serverId: request.serverId,
          optionId: request.optionId,
          serverName: server.name,
          installMode: server.type,
        },
        serverId: server.id,
      })

      return server
    },
  )

  log.info('[ipc] registry handlers registered')
}
