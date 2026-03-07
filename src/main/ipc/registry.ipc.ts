/**
 * @file src/main/ipc/registry.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for the registry domain. Browsing (search) is
 * available on the free tier. One-click install is a Pro feature gated behind
 * the `registryInstall` feature flag.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { McpServer } from '@shared/types'
import type { RegistryServer } from '@shared/channels'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { checkGate } from '@main/licensing/feature-gates'
import { smitheryClient } from '@main/registry/smithery.client'

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
  ipcMain.handle('registry:search', async (_event, query: string): Promise<RegistryServer[]> => {
    log.debug(`[ipc] registry:search "${query}"`)
    return smitheryClient.searchServers(query)
  })

  // ── registry:install ────────────────────────────────────────────────────
  ipcMain.handle('registry:install', (_event, qualifiedName: string): Promise<McpServer> => {
    log.debug(`[ipc] registry:install "${qualifiedName}"`)

    // Pro-only feature.
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

    // Derive a friendly name from the qualified name (last path segment).
    const name = qualifiedName.split('/').pop() ?? qualifiedName

    const server = servers.create({
      name,
      type: 'stdio',
      command: 'npx',
      args: ['-y', qualifiedName],
      env: {},
      secretEnvKeys: [],
      tags: ['registry'],
      notes: `Installed from Smithery registry: ${qualifiedName}`,
    })

    logRepo.insert({
      action: 'registry.installed',
      details: { qualifiedName, serverName: server.name },
      serverId: server.id,
    })

    return Promise.resolve(server)
  })

  log.info('[ipc] registry handlers registered')
}
