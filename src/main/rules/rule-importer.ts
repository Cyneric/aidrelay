/**
 * @file src/main/rules/rule-importer.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Scans a project directory for AI rule files used by various
 * clients and imports them into the aidrelay rules database. Each file type is
 * parsed with the matching format-converter function. Existing rules with the
 * same name are skipped to avoid duplicates. All imported rules are tagged
 * with their source and scoped to the scanned project directory.
 *
 * Supported source files:
 *   - `.cursor/rules/*.mdc`          (Cursor IDE)
 *   - `CLAUDE.md`                    (Claude Code, project-root)
 *   - `.claude/rules/*.md`           (Claude Code, per-rule)
 *   - `AGENTS.md`                    (Codex CLI, project-root)
 *   - `.codex/AGENTS.md`             (Codex CLI, nested)
 *   - `.github/copilot-instructions.md` (VS Code)
 *   - `.windsurfrules`               (Windsurf)
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, basename, extname } from 'path'
import log from 'electron-log'
import type { Database } from 'better-sqlite3'
import type { ImportResult } from '@shared/channels'
import { RulesRepo } from '@main/db/rules.repo'
import { estimateTokens } from '@main/rules/token-estimator'
import { parseCursorMdc, parseClaudeCodeMd, parseConcatMd } from './format-converter'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reads a file, returning `null` on any error. */
const safeRead = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

/** Collects `.mdc` files from a directory, returning an empty array if absent. */
const listMdcFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter((f) => extname(f) === '.mdc')
      .map((f) => join(dir, f))
  } catch {
    return []
  }
}

/** Collects `.md` files from a directory, returning an empty array if absent. */
const listMdFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter((f) => extname(f) === '.md')
      .map((f) => join(dir, f))
  } catch {
    return []
  }
}

// ─── Importer ─────────────────────────────────────────────────────────────────

/**
 * Imports AI rule files from an existing project directory into aidrelay.
 */
export class RuleImporter {
  private readonly repo: RulesRepo

  constructor(db: Database) {
    this.repo = new RulesRepo(db)
  }

  /**
   * Scans `dirPath` for all known rule file locations, parses each one, and
   * inserts new rules into the database. Skips rules whose `name` already
   * exists (case-insensitive match on the current rule names).
   *
   * @param dirPath - Absolute path to the project root to scan.
   * @returns Import result summary: imported count, skipped count, errors.
   */
  importFromDirectory(dirPath: string): ImportResult {
    let imported = 0
    let skipped = 0
    const errors: string[] = []

    // Build a set of existing names for dedup check (lowercase)
    const existing = new Set(this.repo.findAll().map((r) => r.name.toLowerCase()))

    const candidates: Array<{ name: string; content: string; source: string; tags?: string[] }> = []

    // ── Cursor rules (.cursor/rules/*.mdc) ────────────────────────────────
    for (const filePath of listMdcFiles(join(dirPath, '.cursor', 'rules'))) {
      const content = safeRead(filePath)
      if (!content) continue
      const name = basename(filePath, '.mdc')
      const parsed = parseCursorMdc(content, name)
      candidates.push({
        name: parsed.name ?? name,
        content: parsed.content ?? content,
        source: 'cursor-import',
        tags: ['cursor-import', ...(parsed.fileGlobs ?? [])],
      })
    }

    // ── Claude Code per-rule files (.claude/rules/*.md) ───────────────────
    for (const filePath of listMdFiles(join(dirPath, '.claude', 'rules'))) {
      const content = safeRead(filePath)
      if (!content) continue
      const name = basename(filePath, '.md')
      const parsed = parseClaudeCodeMd(content, name)
      candidates.push({
        name: parsed.name ?? name,
        content: parsed.content ?? content,
        source: 'claude-code-import',
        tags: ['claude-code-import'],
      })
    }

    // ── CLAUDE.md project-root file ───────────────────────────────────────
    const claudeMd = safeRead(join(dirPath, 'CLAUDE.md'))
    if (claudeMd) {
      candidates.push({
        name: 'CLAUDE',
        content: claudeMd.trim(),
        source: 'claude-code-import',
        tags: ['claude-code-import'],
      })
    }

    // ── VS Code copilot-instructions.md ───────────────────────────────────
    const copilotMd = safeRead(join(dirPath, '.github', 'copilot-instructions.md'))
    if (copilotMd) {
      const sections = parseConcatMd(copilotMd, 'vscode-import')
      if (sections.length === 0) {
        candidates.push({
          name: 'copilot-instructions',
          content: copilotMd.trim(),
          source: 'vscode-import',
          tags: ['vscode-import'],
        })
      } else {
        for (const s of sections) {
          candidates.push({
            name: s.name ?? 'copilot-instructions',
            content: s.content ?? '',
            source: 'vscode-import',
            tags: ['vscode-import'],
          })
        }
      }
    }

    // ── Windsurf .windsurfrules ───────────────────────────────────────────
    const windsurfRules = safeRead(join(dirPath, '.windsurfrules'))
    if (windsurfRules) {
      const sections = parseConcatMd(windsurfRules, 'windsurf-import')
      if (sections.length === 0) {
        candidates.push({
          name: 'windsurfrules',
          content: windsurfRules.trim(),
          source: 'windsurf-import',
          tags: ['windsurf-import'],
        })
      } else {
        for (const s of sections) {
          candidates.push({
            name: s.name ?? 'windsurfrules',
            content: s.content ?? '',
            source: 'windsurf-import',
            tags: ['windsurf-import'],
          })
        }
      }
    }

    // ── AGENTS.md (project root) ──────────────────────────────────────────
    const agentsMdRoot = safeRead(join(dirPath, 'AGENTS.md'))
    if (agentsMdRoot) {
      candidates.push({
        name: 'AGENTS',
        content: agentsMdRoot.trim(),
        source: 'codex-import',
        tags: ['codex-import'],
      })
    }

    // ── .codex/AGENTS.md ─────────────────────────────────────────────────
    const agentsMdCodex = safeRead(join(dirPath, '.codex', 'AGENTS.md'))
    if (agentsMdCodex) {
      const sections = parseConcatMd(agentsMdCodex, 'codex-import')
      if (sections.length === 0) {
        candidates.push({
          name: 'AGENTS-codex',
          content: agentsMdCodex.trim(),
          source: 'codex-import',
          tags: ['codex-import'],
        })
      } else {
        for (const s of sections) {
          candidates.push({
            name: s.name ?? 'AGENTS-codex',
            content: s.content ?? '',
            source: 'codex-import',
            tags: ['codex-import'],
          })
        }
      }
    }

    // ── Insert candidates ─────────────────────────────────────────────────
    for (const candidate of candidates) {
      if (!candidate.content.trim()) {
        log.debug(`[rule-importer] Skipping empty rule "${candidate.name}"`)
        skipped++
        continue
      }

      if (existing.has(candidate.name.toLowerCase())) {
        log.debug(`[rule-importer] Skipping duplicate rule "${candidate.name}"`)
        skipped++
        continue
      }

      try {
        const created = this.repo.create({
          name: candidate.name,
          content: candidate.content,
          category: candidate.source,
          priority: 'normal',
          scope: 'project',
          projectPath: dirPath,
          fileGlobs: [],
          alwaysApply: false,
          tags: candidate.tags ?? [candidate.source],
        })

        // Persist a token estimate so table/budget views are consistent with editor badges.
        this.repo.update(created.id, { tokenEstimate: estimateTokens(candidate.content) })
        existing.add(candidate.name.toLowerCase())
        imported++
        log.debug(`[rule-importer] Imported rule "${candidate.name}" from ${candidate.source}`)
      } catch (err) {
        const msg = `Failed to import "${candidate.name}": ${String(err)}`
        log.error(`[rule-importer] ${msg}`)
        errors.push(msg)
      }
    }

    log.info(
      `[rule-importer] Scan of "${dirPath}" complete — ${imported} imported, ${skipped} skipped, ${errors.length} errors`,
    )
    return { imported, skipped, errors }
  }
}
