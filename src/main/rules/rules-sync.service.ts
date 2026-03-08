/**
 * @file src/main/rules/rules-sync.service.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Writes AI rules to the file-system paths expected by each
 * installed AI client. Each client has its own strategy:
 *
 *   - claude-code  → individual `.md` files in `%USERPROFILE%\.claude\rules\`
 *   - cursor       → individual `.mdc` files in `%USERPROFILE%\.cursor\rules\`
 *   - vscode       → single concatenated file: `{project}\.github\copilot-instructions.md`
 *   - vscode-insiders → single concatenated file: `{project}\.github\copilot-instructions.md`
 *   - windsurf     → single concatenated file: `{project}\.windsurfrules`
 *   - codex-cli    → single concatenated file: `{project}\.codex\AGENTS.md`
 *   - codex-gui    → single concatenated file: `{project}\.codex\AGENTS.md`
 *   - opencode     → project `opencode.json` top-level `instructions` field
 *   - visual-studio → single concatenated file: `{project}\.github\copilot-instructions.md`
 *
 * Global-scope rules are written to the tool's global rules directory.
 * Project-scope rules are written to the matching project directory.
 * VS Code-family, Windsurf, Codex, and OpenCode do not have global paths — project-scoped
 * rules without a valid `projectPath` are silently skipped with a warning.
 *
 * All writes are atomic: content is first written to a `.aidrelay.tmp` file,
 * then renamed to the final destination.
 */

import { writeFileSync, mkdirSync, renameSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import log from 'electron-log'
import type { AiRule, SyncResult, ClientId } from '@shared/types'
import type { Database } from 'better-sqlite3'
import { RulesRepo } from '@main/db/rules.repo'
import { ActivityLogRepo } from '@main/db/activity-log.repo'
import { toClaudeCodeMd, toCursorMdc, toConcat } from './format-converter'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Writes `content` to `targetPath` atomically by writing a `.aidrelay.tmp`
 * sidecar first, then renaming it into place. Parent directories are created
 * recursively if they do not exist.
 */
const atomicWrite = (targetPath: string, content: string): void => {
  const dir = dirname(targetPath)
  mkdirSync(dir, { recursive: true })
  const tmp = targetPath + '.aidrelay.tmp'
  writeFileSync(tmp, content, 'utf-8')
  renameSync(tmp, targetPath)
}

/**
 * Sanitises a rule name to a safe file-system identifier.
 * Replaces spaces and non-alphanumeric characters (except hyphens/underscores)
 * with hyphens and lowercases the result.
 */
const toFileName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'rule'

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Syncs all enabled rules for one or all clients to their expected file-system
 * locations. Call `sync(clientId)` for a single client or `syncAll(rules)` for
 * all installed clients at once.
 */
export class RulesSyncService {
  private readonly rulesRepo: RulesRepo
  private readonly logRepo: ActivityLogRepo
  private readonly userProfile: string

  constructor(db: Database) {
    this.rulesRepo = new RulesRepo(db)
    this.logRepo = new ActivityLogRepo(db)
    this.userProfile = process.env['USERPROFILE'] ?? ''
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Syncs all enabled rules to a single client.
   * Returns a `SyncResult` indicating success or the first error encountered.
   *
   * @param clientId - Target client identifier.
   * @returns Sync result for the client.
   */
  sync(clientId: ClientId): SyncResult {
    const rules = this.rulesRepo.findAll().filter((r) => this.isEnabledForClient(r, clientId))

    try {
      const written = this.writeForClient(clientId, rules)

      this.logRepo.insert({
        action: 'rules.sync.performed',
        details: { clientId, rulesWritten: written },
      })

      return {
        clientId,
        success: true,
        serversWritten: written,
        syncedAt: new Date().toISOString(),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`[rules-sync] Failed to sync to ${clientId}: ${message}`)

      this.logRepo.insert({
        action: 'rules.sync.failed',
        details: { clientId, error: message },
      })

      return {
        clientId,
        success: false,
        serversWritten: 0,
        error: message,
        syncedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Syncs rules to all provided client IDs.
   *
   * @param clientIds - List of client identifiers to sync.
   * @returns Array of sync results, one per client.
   */
  syncAll(clientIds: readonly ClientId[]): SyncResult[] {
    return clientIds.map((id) => this.sync(id))
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Returns `true` when a rule should be included for the given client.
   * A rule is excluded if its global `enabled` flag is `false`, or if it has
   * a per-client override that explicitly disables it.
   */
  private isEnabledForClient(rule: AiRule, clientId: ClientId): boolean {
    if (!rule.enabled) return false
    const override = rule.clientOverrides[clientId]
    return override === undefined || override.enabled
  }

  /**
   * Dispatches to the correct write strategy for the given client.
   * Returns the number of files (or rule sections) written.
   */
  private writeForClient(clientId: ClientId, rules: readonly AiRule[]): number {
    switch (clientId) {
      case 'claude-code':
        return this.writeIndividualMd(
          rules,
          join(this.userProfile, '.claude', 'rules'),
          '.md',
          toClaudeCodeMd,
        )
      case 'cursor':
        return this.writeIndividualMd(
          rules,
          join(this.userProfile, '.cursor', 'rules'),
          '.mdc',
          toCursorMdc,
        )
      case 'vscode':
      case 'vscode-insiders':
      case 'visual-studio':
        return this.writeConcat(rules, (projectPath) =>
          join(projectPath, '.github', 'copilot-instructions.md'),
        )
      case 'windsurf':
        return this.writeConcat(rules, (projectPath) => join(projectPath, '.windsurfrules'))
      case 'codex-cli':
      case 'codex-gui':
        return this.writeConcat(rules, (projectPath) => join(projectPath, '.codex', 'AGENTS.md'))
      case 'opencode':
        return this.writeOpenCode(rules)
      default:
        // Other clients (claude-desktop, zed, jetbrains) do not support rules files.
        log.debug(`[rules-sync] Client ${clientId} does not support rules sync — skipping`)
        return 0
    }
  }

  /**
   * Writes one file per rule to a flat directory (claude-code + cursor strategy).
   * Global-scoped rules go to `baseDir`. Project-scoped rules go to a
   * `{projectPath}/.claude/rules/` or `{projectPath}/.cursor/rules/` dir.
   */
  private writeIndividualMd(
    rules: readonly AiRule[],
    globalBaseDir: string,
    ext: string,
    serialise: (rule: AiRule) => string,
  ): number {
    let written = 0
    for (const rule of rules) {
      const baseDir =
        rule.scope === 'project' && rule.projectPath
          ? join(rule.projectPath, ext === '.mdc' ? '.cursor/rules' : '.claude/rules')
          : globalBaseDir

      if (rule.scope === 'project' && !rule.projectPath) {
        log.warn(
          `[rules-sync] Rule "${rule.name}" is project-scoped but has no projectPath — skipping`,
        )
        continue
      }

      const filePath = join(baseDir, `${toFileName(rule.name)}${ext}`)

      if (!existsSync(dirname(filePath))) {
        mkdirSync(dirname(filePath), { recursive: true })
      }

      atomicWrite(filePath, serialise(rule))
      written++
    }
    return written
  }

  /**
   * Writes all rules for a given project path into a single concatenated file
   * (vscode-family / windsurf / codex strategy). Rules without a `projectPath`
   * are skipped (no global path for these clients).
   */
  private writeConcat(rules: readonly AiRule[], pathFor: (projectPath: string) => string): number {
    // Group rules by project path (only project-scoped rules have one)
    const byProject = new Map<string, AiRule[]>()

    for (const rule of rules) {
      if (!rule.projectPath) {
        log.warn(`[rules-sync] Rule "${rule.name}" has no projectPath — skipping for concat client`)
        continue
      }
      const existing = byProject.get(rule.projectPath) ?? []
      existing.push(rule)
      byProject.set(rule.projectPath, existing)
    }

    let written = 0
    for (const [projectPath, projectRules] of byProject) {
      const filePath = pathFor(projectPath)
      atomicWrite(filePath, toConcat(projectRules))
      written += projectRules.length
    }
    return written
  }

  /**
   * Writes OpenCode project config files with concatenated instructions under
   * the top-level `instructions` key.
   */
  private writeOpenCode(rules: readonly AiRule[]): number {
    const byProject = new Map<string, AiRule[]>()

    for (const rule of rules) {
      if (!rule.projectPath) {
        log.warn(`[rules-sync] Rule "${rule.name}" has no projectPath — skipping for opencode`)
        continue
      }
      const existing = byProject.get(rule.projectPath) ?? []
      existing.push(rule)
      byProject.set(rule.projectPath, existing)
    }

    let written = 0
    for (const [projectPath, projectRules] of byProject) {
      const filePath = join(projectPath, 'opencode.json')
      let existing: Record<string, unknown> = {}

      if (existsSync(filePath)) {
        try {
          existing = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
        } catch {
          existing = {}
        }
      }

      const merged = { ...existing, instructions: toConcat(projectRules) }
      atomicWrite(filePath, JSON.stringify(merged, null, 2))
      written += projectRules.length
    }
    return written
  }
}
