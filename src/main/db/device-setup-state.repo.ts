/**
 * @file src/main/db/device-setup-state.repo.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Repository for the `device_setup_state` table, which stores
 * per-device installation state (never synced across devices). Each row
 * corresponds to one server on one device.
 */

import type Database from 'better-sqlite3'
import type { DeviceSetupState, LogEntry } from '@shared/types'

// ─── Row Shape ────────────────────────────────────────────────────────────────

interface DeviceSetupStateRow {
  device_id: string
  server_id: string
  runtime_detection_results: string
  logs: string
  install_status: string
  created_at: string
  updated_at: string
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

const rowToDomain = (row: DeviceSetupStateRow): DeviceSetupState => {
  let runtimeDetectionResults: Record<string, boolean> = {}
  try {
    runtimeDetectionResults = JSON.parse(row.runtime_detection_results) as Record<string, boolean>
  } catch {
    // ignore malformed JSON, treat as empty object
  }

  let logs: LogEntry[] = []
  try {
    logs = JSON.parse(row.logs) as LogEntry[]
  } catch {
    // ignore malformed JSON, treat as empty array
  }

  return {
    deviceId: row.device_id,
    serverId: row.server_id,
    runtimeDetectionResults,
    logs,
    installStatus: row.install_status as DeviceSetupState['installStatus'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const domainToRow = (state: DeviceSetupState): DeviceSetupStateRow => ({
  device_id: state.deviceId,
  server_id: state.serverId,
  runtime_detection_results: JSON.stringify(state.runtimeDetectionResults),
  logs: JSON.stringify(state.logs),
  install_status: state.installStatus,
  created_at: state.createdAt,
  updated_at: state.updatedAt,
})

// ─── Repository ───────────────────────────────────────────────────────────────

export class DeviceSetupStateRepo {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  /**
   * Find the setup state for a specific server on the current device.
   * If no row exists, returns `null`.
   */
  findByServerId(deviceId: string, serverId: string): DeviceSetupState | null {
    const row = this.db
      .prepare(
        `SELECT * FROM device_setup_state
         WHERE device_id = ? AND server_id = ?`,
      )
      .get(deviceId, serverId) as DeviceSetupStateRow | undefined

    return row ? rowToDomain(row) : null
  }

  /**
   * Insert a new setup state row. Throws if a row for the same
   * device+server already exists (use `upsert` for updates).
   */
  insert(state: DeviceSetupState): void {
    const row = domainToRow(state)
    this.db
      .prepare(
        `INSERT INTO device_setup_state
         (device_id, server_id, runtime_detection_results, logs, install_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.device_id,
        row.server_id,
        row.runtime_detection_results,
        row.logs,
        row.install_status,
        row.created_at,
        row.updated_at,
      )
  }

  /**
   * Update an existing setup state row.
   */
  update(state: DeviceSetupState): void {
    const row = domainToRow(state)
    this.db
      .prepare(
        `UPDATE device_setup_state
         SET runtime_detection_results = ?,
             logs = ?,
             install_status = ?,
             updated_at = ?
         WHERE device_id = ? AND server_id = ?`,
      )
      .run(
        row.runtime_detection_results,
        row.logs,
        row.install_status,
        row.updated_at,
        row.device_id,
        row.server_id,
      )
  }

  /**
   * Upsert a setup state row (insert or update).
   */
  upsert(state: DeviceSetupState): void {
    const existing = this.findByServerId(state.deviceId, state.serverId)
    if (existing) {
      this.update(state)
    } else {
      this.insert(state)
    }
  }

  /**
   * Delete the setup state for a specific server on the current device.
   */
  delete(deviceId: string, serverId: string): void {
    this.db
      .prepare(`DELETE FROM device_setup_state WHERE device_id = ? AND server_id = ?`)
      .run(deviceId, serverId)
  }

  /**
   * List all setup states for the current device.
   */
  listAll(deviceId: string): DeviceSetupState[] {
    const rows = this.db
      .prepare(`SELECT * FROM device_setup_state WHERE device_id = ? ORDER BY updated_at DESC`)
      .all(deviceId) as DeviceSetupStateRow[]

    return rows.map(rowToDomain)
  }
}
