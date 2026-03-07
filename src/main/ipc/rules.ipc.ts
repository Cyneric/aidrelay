/**
 * @file src/main/ipc/rules.ipc.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description IPC handlers for all rule-related channels. Wires the renderer
 * to `RulesRepo` for CRUD operations, calculates token estimates on every
 * content save, and writes activity log entries for every state-changing
 * action. Import and workspace detection use `RuleImporter` and
 * `detectRecentWorkspaces` respectively.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { AiRule, SyncResult, ClientId } from '@shared/types'
import type { CreateRuleInput, UpdateRuleInput, ImportResult } from '@shared/channels'
import { getDatabase } from '@main/db/connection'
import { RulesRepo } from '@main/db/rules.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { estimateTokens } from '@main/rules/token-estimator'
import { RulesSyncService } from '@main/rules/rules-sync.service'
import { RuleImporter } from '@main/rules/rule-importer'
import { detectRecentWorkspaces } from '@main/rules/workspace-detector'
import { ADAPTERS, ADAPTER_IDS } from '@main/clients/registry'
import { checkGate } from '@main/licensing/feature-gates'

// ─── Service Factory ──────────────────────────────────────────────────────────

/**
 * Creates `RulesRepo` and `ActivityLogRepo` instances backed by the live DB.
 * Called per-handler so there is never stale state from a previous call.
 */
const createRepos = (): { rules: RulesRepo; log: ActivityLogRepo } => {
  const db = getDatabase()
  return { rules: new RulesRepo(db), log: new ActivityLogRepo(db) }
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `rules:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerRulesIpc = (): void => {
  // ── rules:list ────────────────────────────────────────────────────────────
  ipcMain.handle('rules:list', (): AiRule[] => {
    log.debug('[ipc] rules:list')
    const { rules } = createRepos()
    return rules.findAll()
  })

  // ── rules:get ─────────────────────────────────────────────────────────────
  ipcMain.handle('rules:get', (_event, id: string): AiRule | null => {
    log.debug(`[ipc] rules:get ${id}`)
    const { rules } = createRepos()
    return rules.findById(id)
  })

  // ── rules:create ──────────────────────────────────────────────────────────
  ipcMain.handle('rules:create', (_event, input: CreateRuleInput): AiRule => {
    log.debug(`[ipc] rules:create "${input.name}"`)
    const { rules, log: logRepo } = createRepos()

    // Enforce the per-tier rule limit before creating.
    const maxRules = checkGate('maxRules')
    const currentCount = rules.findAll().length
    if (currentCount >= maxRules) {
      throw new Error(
        `Rule limit reached (${maxRules}). Upgrade to aidrelay Pro for unlimited rules.`,
      )
    }

    const rule = rules.create(input)

    // Calculate and persist the token estimate immediately after creation.
    const tokenEstimate = estimateTokens(rule.content)
    const withEstimate = rules.update(rule.id, { tokenEstimate })

    logRepo.insert({
      action: 'rule.created',
      details: { ruleName: withEstimate.name, category: withEstimate.category },
    })

    return withEstimate
  })

  // ── rules:update ──────────────────────────────────────────────────────────
  ipcMain.handle('rules:update', (_event, id: string, updates: UpdateRuleInput): AiRule => {
    log.debug(`[ipc] rules:update ${id}`)
    const { rules, log: logRepo } = createRepos()

    // Recalculate the token estimate whenever content is part of the update.
    const contentUpdate =
      updates.content !== undefined ? { tokenEstimate: estimateTokens(updates.content) } : {}

    const rule = rules.update(id, { ...updates, ...contentUpdate })

    logRepo.insert({
      action: 'rule.updated',
      details: { ruleName: rule.name, updatedFields: Object.keys(updates) },
    })

    return rule
  })

  // ── rules:delete ──────────────────────────────────────────────────────────
  ipcMain.handle('rules:delete', (_event, id: string): void => {
    log.debug(`[ipc] rules:delete ${id}`)
    const { rules, log: logRepo } = createRepos()
    const rule = rules.findById(id)
    rules.delete(id)
    logRepo.insert({
      action: 'rule.deleted',
      details: { ruleName: rule?.name ?? id },
    })
  })

  // ── rules:estimate-tokens ─────────────────────────────────────────────────
  ipcMain.handle('rules:estimate-tokens', (_event, content: string): number => {
    return estimateTokens(content)
  })

  // ── rules:sync ────────────────────────────────────────────────────────────
  ipcMain.handle('rules:sync', (_event, clientId: ClientId): SyncResult => {
    log.debug(`[ipc] rules:sync ${clientId}`)
    const syncService = new RulesSyncService(getDatabase())
    return syncService.sync(clientId)
  })

  // ── rules:sync-all ────────────────────────────────────────────────────────
  ipcMain.handle('rules:sync-all', async (): Promise<SyncResult[]> => {
    log.debug('[ipc] rules:sync-all')
    const syncService = new RulesSyncService(getDatabase())

    // Discover installed clients dynamically — same pattern as clients:sync-all.
    const installedIds: ClientId[] = []
    for (const id of ADAPTER_IDS) {
      const detection = await ADAPTERS.get(id)!.detect()
      if (detection.installed) installedIds.push(id)
    }

    return syncService.syncAll(installedIds)
  })

  // ── rules:import-from-project ─────────────────────────────────────────────
  ipcMain.handle('rules:import-from-project', (_event, dirPath: string): ImportResult => {
    log.debug(`[ipc] rules:import-from-project ${dirPath}`)
    const importer = new RuleImporter(getDatabase())
    return importer.importFromDirectory(dirPath)
  })

  // ── rules:detect-workspaces ───────────────────────────────────────────────
  ipcMain.handle('rules:detect-workspaces', (): string[] => {
    log.debug('[ipc] rules:detect-workspaces')
    return detectRecentWorkspaces()
  })

  log.info('[ipc] rules handlers registered')
}
