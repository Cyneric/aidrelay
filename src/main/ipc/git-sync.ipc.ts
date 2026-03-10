/**
 * @file src/main/ipc/git-sync.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for all git sync channels. Delegates to the
 * `gitSyncService` singleton and enforces the `gitSync` Pro feature gate on
 * every handler so free-tier users receive a consistent error message.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import { gitSyncService } from '@main/git-sync/git-sync.service'
import { checkGate } from '@main/licensing/feature-gates'
import type {
  GitSyncStatus,
  GitPushResult,
  GitPullResult,
  GitRemoteTestResult,
} from '@shared/types'
import type { ManualGitConfig } from '@shared/types'

// ─── Gate Helper ──────────────────────────────────────────────────────────────

/**
 * Throws a user-friendly error when the current license tier does not include
 * git sync. Called at the top of every write/connect handler.
 *
 * @throws {Error} When the `gitSync` feature gate is disabled.
 */
const requireGitSyncGate = (): void => {
  if (!checkGate('gitSync')) {
    throw new Error('Git sync requires an aidrelay Pro subscription.')
  }
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `git-sync:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerGitSyncIpc = (): void => {
  // ── git-sync:status ───────────────────────────────────────────────────────
  ipcMain.handle('git-sync:status', async (): Promise<GitSyncStatus> => {
    log.debug('[ipc] git-sync:status')
    return gitSyncService.getStatus()
  })

  // ── git-sync:connect-github ───────────────────────────────────────────────
  ipcMain.handle('git-sync:connect-github', async (): Promise<GitSyncStatus> => {
    log.debug('[ipc] git-sync:connect-github')
    requireGitSyncGate()
    return gitSyncService.connectGitHub()
  })

  // ── git-sync:connect-manual ───────────────────────────────────────────────
  ipcMain.handle(
    'git-sync:connect-manual',
    async (_event, config: ManualGitConfig): Promise<GitSyncStatus> => {
      log.debug(`[ipc] git-sync:connect-manual ${config.remoteUrl}`)
      requireGitSyncGate()
      return gitSyncService.connectManual(config)
    },
  )

  // ── git-sync:test-remote ──────────────────────────────────────────────────
  ipcMain.handle(
    'git-sync:test-remote',
    async (_event, config: ManualGitConfig): Promise<GitRemoteTestResult> => {
      log.debug(`[ipc] git-sync:test-remote ${config.remoteUrl}`)
      requireGitSyncGate()
      return gitSyncService.testRemote(config)
    },
  )

  // ── git-sync:disconnect ───────────────────────────────────────────────────
  ipcMain.handle('git-sync:disconnect', async (): Promise<void> => {
    log.debug('[ipc] git-sync:disconnect')
    requireGitSyncGate()
    return gitSyncService.disconnect()
  })

  // ── git-sync:push ─────────────────────────────────────────────────────────
  ipcMain.handle('git-sync:push', async (): Promise<GitPushResult> => {
    log.debug('[ipc] git-sync:push')
    requireGitSyncGate()
    return gitSyncService.push()
  })

  // ── git-sync:pull ─────────────────────────────────────────────────────────
  ipcMain.handle('git-sync:pull', async (): Promise<GitPullResult> => {
    log.debug('[ipc] git-sync:pull')
    requireGitSyncGate()
    return gitSyncService.pull()
  })

  log.info('[ipc] git-sync handlers registered')
}
