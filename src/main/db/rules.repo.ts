/**
 * @file src/main/db/rules.repo.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Repository for AI rule records. Handles all CRUD operations
 * against the `rules` table, mapping between the DB's snake_case rows and
 * the shared `AiRule` domain type. JSON columns are serialized transparently.
 */

import type Database from 'better-sqlite3'
import type { AiRule, ClientId, RulePriority, RuleScope } from '@shared/types'
import type { CreateRuleInput, UpdateRuleInput } from '@shared/channels'

// ─── Row Shape ────────────────────────────────────────────────────────────────

/**
 * Raw row shape as returned by better-sqlite3 for the `rules` table.
 */
interface RuleRow {
  id: string
  name: string
  description: string
  content: string
  category: string
  tags: string
  enabled: number
  priority: string
  scope: string
  project_path: string | null
  file_globs: string
  always_apply: number
  client_overrides: string
  token_estimate: number
  created_at: string
  updated_at: string
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Converts a raw database row into the shared `AiRule` domain type.
 *
 * @param row - The raw SQLite row from the `rules` table.
 * @returns The hydrated `AiRule` object.
 */
const rowToRule = (row: RuleRow): AiRule => ({
  id: row.id,
  name: row.name,
  description: row.description,
  content: row.content,
  category: row.category,
  tags: JSON.parse(row.tags) as string[],
  enabled: row.enabled === 1,
  priority: row.priority as RulePriority,
  scope: row.scope as RuleScope,
  // With exactOptionalPropertyTypes, optional fields must be absent rather than
  // explicitly set to undefined — use a conditional spread to omit when null.
  ...(row.project_path != null && { projectPath: row.project_path }),
  fileGlobs: JSON.parse(row.file_globs) as string[],
  alwaysApply: row.always_apply === 1,
  clientOverrides: JSON.parse(row.client_overrides) as Record<ClientId, { enabled: boolean }>,
  tokenEstimate: row.token_estimate,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Provides typed CRUD operations for AI rule records.
 * Accepts a `Database` instance at construction so tests can inject an
 * in-memory database without needing the Electron app to be running.
 */
export class RulesRepo {
  constructor(private readonly db: Database.Database) {}

  /**
   * Returns all rule records ordered by category, then name.
   *
   * @returns Array of all `AiRule` entries.
   */
  findAll(): AiRule[] {
    const rows = this.db.prepare('SELECT * FROM rules ORDER BY category, name').all() as RuleRow[]
    return rows.map(rowToRule)
  }

  /**
   * Finds a single rule by its UUID.
   *
   * @param id - The rule UUID to look up.
   * @returns The matching `AiRule`, or `null` if not found.
   */
  findById(id: string): AiRule | null {
    const row = this.db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as RuleRow | undefined
    return row ? rowToRule(row) : null
  }

  /**
   * Creates a new rule record and returns the persisted entity.
   *
   * @param input - The fields required to create the rule.
   * @returns The newly created `AiRule`.
   */
  create(input: CreateRuleInput): AiRule {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO rules
          (id, name, description, content, category, tags, enabled, priority,
           scope, project_path, file_globs, always_apply, client_overrides,
           token_estimate, created_at, updated_at)
         VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.description ?? '',
        input.content,
        input.category ?? 'general',
        JSON.stringify(input.tags ?? []),
        1,
        input.priority ?? 'normal',
        input.scope ?? 'global',
        input.projectPath ?? null,
        JSON.stringify(input.fileGlobs ?? []),
        input.alwaysApply ? 1 : 0,
        JSON.stringify({}),
        0,
        now,
        now,
      )

    return this.findById(id)!
  }

  /**
   * Applies a partial update to an existing rule record.
   *
   * @param id - UUID of the rule to update.
   * @param updates - The fields to change. Unspecified fields are left as-is.
   * @returns The updated `AiRule`.
   * @throws {Error} If no rule with the given `id` exists.
   */
  update(id: string, updates: UpdateRuleInput): AiRule {
    const existing = this.findById(id)
    if (!existing) throw new Error(`Rule not found: ${id}`)

    const now = new Date().toISOString()

    this.db
      .prepare(
        `UPDATE rules SET
          name = ?, description = ?, content = ?, category = ?, tags = ?,
          priority = ?, scope = ?, project_path = ?, file_globs = ?,
          always_apply = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        updates.name ?? existing.name,
        updates.description ?? existing.description,
        updates.content ?? existing.content,
        updates.category ?? existing.category,
        JSON.stringify(updates.tags ?? existing.tags),
        updates.priority ?? existing.priority,
        updates.scope ?? existing.scope,
        updates.projectPath ?? existing.projectPath ?? null,
        JSON.stringify(updates.fileGlobs ?? existing.fileGlobs),
        (updates.alwaysApply ?? existing.alwaysApply) ? 1 : 0,
        now,
        id,
      )

    return this.findById(id)!
  }

  /**
   * Deletes a rule record by ID.
   *
   * @param id - UUID of the rule to remove.
   */
  delete(id: string): void {
    this.db.prepare('DELETE FROM rules WHERE id = ?').run(id)
  }
}
