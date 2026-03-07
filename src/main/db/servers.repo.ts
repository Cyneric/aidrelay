/**
 * @file src/main/db/servers.repo.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Repository for MCP server records. Handles all CRUD operations
 * against the `servers` table, mapping between the DB's snake_case rows and
 * the shared `McpServer` domain type. JSON columns are serialized/deserialized
 * transparently so callers always work with plain TypeScript objects.
 */

import type Database from 'better-sqlite3'
import type { McpServer, ClientId } from '@shared/types'
import type { CreateServerInput, UpdateServerInput } from '@shared/channels'

// ─── Row Shape ────────────────────────────────────────────────────────────────

/**
 * Raw row shape as returned by better-sqlite3 for the `servers` table.
 * All JSON columns arrive as raw strings and must be parsed before use.
 */
interface ServerRow {
  id: string
  name: string
  type: string
  command: string
  args: string
  env: string
  secret_env_keys: string
  enabled: number
  client_overrides: string
  tags: string
  notes: string
  created_at: string
  updated_at: string
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Converts a raw database row into the shared `McpServer` domain type.
 *
 * @param row - The raw SQLite row from the `servers` table.
 * @returns The hydrated `McpServer` object.
 */
const rowToServer = (row: ServerRow): McpServer => ({
  id: row.id,
  name: row.name,
  type: row.type as McpServer['type'],
  command: row.command,
  args: JSON.parse(row.args) as string[],
  env: JSON.parse(row.env) as Record<string, string>,
  secretEnvKeys: JSON.parse(row.secret_env_keys) as string[],
  enabled: row.enabled === 1,
  clientOverrides: JSON.parse(row.client_overrides) as Record<ClientId, { enabled: boolean }>,
  tags: JSON.parse(row.tags) as string[],
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Provides typed CRUD operations for MCP server records.
 * Accepts a `Database` instance at construction so tests can inject an
 * in-memory database without needing the Electron app to be running.
 */
export class ServersRepo {
  constructor(private readonly db: Database.Database) {}

  /**
   * Returns all server records ordered by name.
   *
   * @returns Array of all `McpServer` entries.
   */
  findAll(): McpServer[] {
    const rows = this.db.prepare('SELECT * FROM servers ORDER BY name').all() as ServerRow[]
    return rows.map(rowToServer)
  }

  /**
   * Finds a single server by its UUID.
   *
   * @param id - The server UUID to look up.
   * @returns The matching `McpServer`, or `null` if not found.
   */
  findById(id: string): McpServer | null {
    const row = this.db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as
      | ServerRow
      | undefined
    return row ? rowToServer(row) : null
  }

  /**
   * Creates a new server record and returns the persisted entity.
   *
   * @param input - The fields required to create the server.
   * @returns The newly created `McpServer`.
   */
  create(input: CreateServerInput): McpServer {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO servers
          (id, name, type, command, args, env, secret_env_keys, enabled,
           client_overrides, tags, notes, created_at, updated_at)
         VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.type,
        input.command,
        JSON.stringify(input.args ?? []),
        JSON.stringify(input.env ?? {}),
        JSON.stringify(input.secretEnvKeys ?? []),
        1,
        JSON.stringify({}),
        JSON.stringify(input.tags ?? []),
        input.notes ?? '',
        now,
        now,
      )

    return this.findById(id)!
  }

  /**
   * Applies a partial update to an existing server record.
   *
   * @param id - UUID of the server to update.
   * @param updates - The fields to change. Unspecified fields are left as-is.
   * @returns The updated `McpServer`.
   * @throws {Error} If no server with the given `id` exists.
   */
  update(id: string, updates: UpdateServerInput): McpServer {
    const existing = this.findById(id)
    if (!existing) throw new Error(`Server not found: ${id}`)

    const now = new Date().toISOString()

    // Merge clientOverrides patch into the existing map so a partial update
    // (e.g. toggling just one client) does not wipe other clients' state.
    const mergedOverrides =
      updates.clientOverrides !== undefined
        ? { ...existing.clientOverrides, ...updates.clientOverrides }
        : existing.clientOverrides

    this.db
      .prepare(
        `UPDATE servers SET
          name = ?, type = ?, command = ?, args = ?, env = ?,
          secret_env_keys = ?, enabled = ?, client_overrides = ?,
          tags = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        updates.name ?? existing.name,
        updates.type ?? existing.type,
        updates.command ?? existing.command,
        JSON.stringify(updates.args ?? existing.args),
        JSON.stringify(updates.env ?? existing.env),
        JSON.stringify(updates.secretEnvKeys ?? existing.secretEnvKeys),
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : existing.enabled ? 1 : 0,
        JSON.stringify(mergedOverrides),
        JSON.stringify(updates.tags ?? existing.tags),
        updates.notes ?? existing.notes,
        now,
        id,
      )

    return this.findById(id)!
  }

  /**
   * Deletes a server record by ID.
   *
   * @param id - UUID of the server to remove.
   */
  delete(id: string): void {
    this.db.prepare('DELETE FROM servers WHERE id = ?').run(id)
  }
}
