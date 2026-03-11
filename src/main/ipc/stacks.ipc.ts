/**
 * @file src/main/ipc/stacks.ipc.ts
 *
 * @created 07.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description IPC handlers for stack export and import. Stacks are portable
 * JSON bundles containing MCP server definitions and AI rules — without
 * secrets, client overrides, or machine-specific IDs. Exporting is a Pro
 * feature; importing is available on the free tier.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
import type { McpServer, AiRule } from '@shared/types'
import type { ImportResult, McpStack } from '@shared/channels'
import { getDatabase } from '@main/db/connection'
import { ServersRepo } from '@main/db/servers.repo'
import { RulesRepo } from '@main/db/rules.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'

// ─── Stack Format Version ─────────────────────────────────────────────────────

/** Schema version embedded in every exported stack file. */
const STACK_VERSION = '1.0.0'

// ─── Service Factory ──────────────────────────────────────────────────────────

const createRepos = (): { servers: ServersRepo; rules: RulesRepo; log: ActivityLogRepo } => {
  const db = getDatabase()
  return {
    servers: new ServersRepo(db),
    rules: new RulesRepo(db),
    log: new ActivityLogRepo(db),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips the fields that should never leave the local machine from a server.
 * Removes the auto-generated `id`, all `secretEnvKeys` (the values already
 * never leave, but the key names reference local credential entries), and
 * the per-client override map (machine-specific toggle state).
 */
const stripServer = (
  s: McpServer,
): Omit<McpServer, 'id' | 'secretEnvKeys' | 'secretHeaderKeys' | 'clientOverrides'> => ({
  name: s.name,
  type: s.type,
  ...(s.url !== undefined ? { url: s.url } : {}),
  command: s.command,
  args: s.args,
  env: s.env,
  headers: s.headers,
  enabled: s.enabled,
  tags: s.tags,
  notes: s.notes,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
  recipeId: s.recipeId,
  recipeVersion: s.recipeVersion,
  setupStatus: s.setupStatus,
  lastInstallResult: s.lastInstallResult,
  lastInstallTimestamp: s.lastInstallTimestamp,
  installPolicy: s.installPolicy,
  normalizedLaunchConfig: s.normalizedLaunchConfig,
})

/**
 * Strips the fields that should never leave the local machine from a rule.
 */
const stripRule = (r: AiRule): Omit<AiRule, 'id' | 'clientOverrides'> => ({
  name: r.name,
  description: r.description,
  content: r.content,
  category: r.category,
  tags: r.tags,
  enabled: r.enabled,
  priority: r.priority,
  scope: r.scope,
  ...(r.projectPath !== undefined ? { projectPath: r.projectPath } : {}),
  fileGlobs: r.fileGlobs,
  alwaysApply: r.alwaysApply,
  tokenEstimate: r.tokenEstimate,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
})

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers all IPC handlers for the `stacks:*` channel namespace.
 * Call this once during app startup from `src/main/ipc/index.ts`.
 */
export const registerStacksIpc = (): void => {
  // ── stacks:export ──────────────────────────────────────────────────────
  ipcMain.handle(
    'stacks:export',
    (_event, serverIds: string[], ruleIds: string[], name: string): Promise<string> => {
      log.debug(
        `[ipc] stacks:export "${name}" (${serverIds.length} servers, ${ruleIds.length} rules)`,
      )

      const { servers, rules, log: logRepo } = createRepos()

      const allServers = servers.findAll()
      const allRules = rules.findAll()

      const selectedServers = serverIds
        .map((id) => allServers.find((s) => s.id === id))
        .filter((s): s is McpServer => s !== undefined)
        .map(stripServer)

      const selectedRules = ruleIds
        .map((id) => allRules.find((r) => r.id === id))
        .filter((r): r is AiRule => r !== undefined)
        .map(stripRule)

      const stack: McpStack = {
        name,
        description: '',
        version: STACK_VERSION,
        servers: selectedServers,
        rules: selectedRules,
        exportedAt: new Date().toISOString(),
      }

      logRepo.insert({
        action: 'stacks.exported',
        details: {
          name,
          serverCount: selectedServers.length,
          ruleCount: selectedRules.length,
        },
      })

      return Promise.resolve(JSON.stringify(stack, null, 2))
    },
  )

  // ── stacks:import ──────────────────────────────────────────────────────
  ipcMain.handle('stacks:import', (_event, json: string): ImportResult => {
    log.debug('[ipc] stacks:import')

    let stack: McpStack
    try {
      const parsed: unknown = JSON.parse(json)
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray((parsed as McpStack).servers) ||
        !Array.isArray((parsed as McpStack).rules)
      ) {
        return {
          imported: 0,
          skipped: 0,
          errors: ['Invalid stack format: missing servers or rules arrays.'],
        }
      }
      stack = parsed as McpStack
    } catch {
      return { imported: 0, skipped: 0, errors: ['Invalid JSON: could not parse stack file.'] }
    }

    const { servers, rules, log: logRepo } = createRepos()

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    // Import servers — deduplicate by name.
    const existingServerNames = new Set(servers.findAll().map((s) => s.name))
    for (const s of stack.servers) {
      if (existingServerNames.has(s.name)) {
        skipped++
        continue
      }
      try {
        servers.create({
          name: s.name,
          type: s.type,
          command: s.command,
          args: [...s.args],
          env: { ...s.env },
          tags: [...s.tags],
          notes: s.notes,
        })
        existingServerNames.add(s.name)
        imported++
      } catch (err) {
        errors.push(`Server "${s.name}": ${String(err)}`)
      }
    }

    // Import rules — deduplicate by name.
    const existingRuleNames = new Set(rules.findAll().map((r) => r.name))
    for (const r of stack.rules) {
      if (existingRuleNames.has(r.name)) {
        skipped++
        continue
      }
      try {
        rules.create({
          name: r.name,
          description: r.description,
          content: r.content,
          category: r.category,
          tags: [...r.tags],
          priority: r.priority,
          scope: r.scope,
          ...(r.projectPath !== undefined ? { projectPath: r.projectPath } : {}),
          fileGlobs: [...r.fileGlobs],
          alwaysApply: r.alwaysApply,
        })
        existingRuleNames.add(r.name)
        imported++
      } catch (err) {
        errors.push(`Rule "${r.name}": ${String(err)}`)
      }
    }

    logRepo.insert({
      action: 'stacks.imported',
      details: { stackName: stack.name, imported, skipped, errors: errors.length },
    })

    return { imported, skipped, errors }
  })

  log.info('[ipc] stacks handlers registered')
}
