/**
 * @file src/main/db/profiles.repo.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Repository for profile records. Handles CRUD against the
 * `profiles` table plus the `setActive()` transaction that ensures only one
 * profile is active at a time. Server and rule override maps are stored as JSON.
 */

import type Database from 'better-sqlite3'
import type { Profile, ClientId } from '@shared/types'
import type { CreateProfileInput, UpdateProfileInput } from '@shared/channels'

// ─── Row Shape ────────────────────────────────────────────────────────────────

/**
 * Raw row shape as returned by better-sqlite3 for the `profiles` table.
 */
interface ProfileRow {
  id: string
  name: string
  description: string
  icon: string
  color: string
  is_active: number
  parent_profile_id: string | null
  server_overrides: string
  rule_overrides: string
  created_at: string
  updated_at: string
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Converts a raw database row into the shared `Profile` domain type.
 *
 * @param row - The raw SQLite row from the `profiles` table.
 * @returns The hydrated `Profile` object.
 */
const rowToProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  name: row.name,
  description: row.description,
  icon: row.icon,
  color: row.color,
  isActive: row.is_active === 1,
  // With exactOptionalPropertyTypes, optional fields must be absent rather than
  // explicitly set to undefined — use a conditional spread to omit when null.
  ...(row.parent_profile_id != null && { parentProfileId: row.parent_profile_id }),
  serverOverrides: JSON.parse(row.server_overrides) as Profile['serverOverrides'],
  ruleOverrides: JSON.parse(row.rule_overrides) as Record<
    string,
    { enabled: boolean; clientOverrides?: Record<ClientId, { enabled: boolean }> }
  >,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Provides typed CRUD operations for profile records, including an atomic
 * `setActive()` transaction that clears all other active flags first.
 */
export class ProfilesRepo {
  constructor(private readonly db: Database.Database) {}

  /**
   * Returns all profiles ordered by name.
   *
   * @returns Array of all `Profile` entries.
   */
  findAll(): Profile[] {
    const rows = this.db.prepare('SELECT * FROM profiles ORDER BY name').all() as ProfileRow[]
    return rows.map(rowToProfile)
  }

  /**
   * Finds a single profile by its UUID.
   *
   * @param id - The profile UUID to look up.
   * @returns The matching `Profile`, or `null` if not found.
   */
  findById(id: string): Profile | null {
    const row = this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as
      | ProfileRow
      | undefined
    return row ? rowToProfile(row) : null
  }

  /**
   * Creates a new profile record.
   *
   * @param input - The fields required to create the profile.
   * @returns The newly created `Profile`.
   */
  create(input: CreateProfileInput): Profile {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO profiles
          (id, name, description, icon, color, is_active,
           parent_profile_id, server_overrides, rule_overrides,
           created_at, updated_at)
         VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.description ?? '',
        input.icon ?? '',
        input.color ?? '#6366f1',
        0,
        input.parentProfileId ?? null,
        JSON.stringify({}),
        JSON.stringify({}),
        now,
        now,
      )

    return this.findById(id)!
  }

  /**
   * Applies a partial update to an existing profile record.
   *
   * @param id - UUID of the profile to update.
   * @param updates - The fields to change.
   * @returns The updated `Profile`.
   * @throws {Error} If no profile with the given `id` exists.
   */
  update(id: string, updates: UpdateProfileInput): Profile {
    const existing = this.findById(id)
    if (!existing) throw new Error(`Profile not found: ${id}`)

    const now = new Date().toISOString()

    this.db
      .prepare(
        `UPDATE profiles SET
          name = ?, description = ?, icon = ?, color = ?,
          parent_profile_id = ?, server_overrides = ?, rule_overrides = ?,
          updated_at = ?
         WHERE id = ?`,
      )
      .run(
        updates.name ?? existing.name,
        updates.description ?? existing.description,
        updates.icon ?? existing.icon,
        updates.color ?? existing.color,
        updates.parentProfileId ?? existing.parentProfileId ?? null,
        JSON.stringify(updates.serverOverrides ?? existing.serverOverrides),
        JSON.stringify(updates.ruleOverrides ?? existing.ruleOverrides),
        now,
        id,
      )

    return this.findById(id)!
  }

  /**
   * Deletes a profile record by ID.
   *
   * @param id - UUID of the profile to remove.
   */
  delete(id: string): void {
    this.db.prepare('DELETE FROM profiles WHERE id = ?').run(id)
  }

  /**
   * Atomically marks a profile as active, clearing the active flag on all
   * others first. Runs inside a transaction so the DB is never left in an
   * inconsistent state if something goes wrong mid-way.
   *
   * @param id - UUID of the profile to activate.
   * @throws {Error} If no profile with the given `id` exists.
   */
  setActive(id: string): void {
    const exists = this.findById(id)
    if (!exists) throw new Error(`Profile not found: ${id}`)

    const clearAll = this.db.prepare('UPDATE profiles SET is_active = 0')
    const setOne = this.db.prepare('UPDATE profiles SET is_active = 1 WHERE id = ?')

    const activate = this.db.transaction((profileId: string) => {
      clearAll.run()
      setOne.run(profileId)
    })

    activate(id)
  }
}
