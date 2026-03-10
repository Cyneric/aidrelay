/**
 * @file src/main/db/migrations/index.ts
 *
 * @created 07.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Exports all SQLite migration scripts as typed string constants.
 * Keeping them here avoids file-path resolution issues across dev, test, and
 * packaged Electron builds — no readFileSync or path gymnastics needed.
 *
 * Migration history:
 *   001 — Initial schema (servers, rules, profiles, backups, activity_log, settings)
 *   002 — Add `url` column to servers (for SSE and HTTP transport types)
 *   003 — Add remote headers + secret header key tracking columns to servers
 *   004 — Add install metadata columns to servers (recipe, setup status, install policy)
 *   005 — Create device_setup_state table for per-device installation state
 *   006 — Create sync_install_intent table for syncing install intent across devices
 *   007 — Create sync_conflicts table for storing merge conflicts
 */

/**
 * Initial database schema — creates all core tables and indexes.
 * Corresponds to the SQL documented in `001_initial.sql`.
 */
export const MIGRATION_001 = /* sql */ `
-- Server registry
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'stdio',
  command TEXT NOT NULL,
  args TEXT NOT NULL DEFAULT '[]',
  env TEXT NOT NULL DEFAULT '{}',
  secret_env_keys TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  client_overrides TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Activity log
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  client_id TEXT,
  server_id TEXT
);

-- Backup history
CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  backup_type TEXT NOT NULL DEFAULT 'sync',
  created_at TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT NOT NULL
);

-- AI Rules
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'normal',
  scope TEXT NOT NULL DEFAULT 'global',
  project_path TEXT,
  file_globs TEXT NOT NULL DEFAULT '[]',
  always_apply INTEGER NOT NULL DEFAULT 0,
  client_overrides TEXT NOT NULL DEFAULT '{}',
  token_estimate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Profiles
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_active INTEGER NOT NULL DEFAULT 0,
  parent_profile_id TEXT,
  server_overrides TEXT NOT NULL DEFAULT '{}',
  rule_overrides TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_profile_id) REFERENCES profiles(id)
);

INSERT INTO profiles (
  id, name, description, icon, color, is_active,
  parent_profile_id, server_overrides, rule_overrides, created_at, updated_at
) VALUES (
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(6))),
  'default',
  '',
  '',
  '#6366f1',
  1,
  NULL,
  '{}',
  '{}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);
CREATE INDEX idx_activity_log_action ON activity_log(action);
CREATE INDEX idx_backups_client ON backups(client_id);
`

/**
 * Migration 002 — Adds the `url` column to the `servers` table.
 * Required for SSE and HTTP transport types where the server is reached via
 * a network endpoint rather than a spawned process.
 */
export const MIGRATION_002 = /* sql */ `
ALTER TABLE servers ADD COLUMN url TEXT NOT NULL DEFAULT '';
`

/**
 * Migration 003 — Adds remote HTTP header support to the `servers` table.
 * `headers` stores non-secret header values and `secret_header_keys` stores
 * only key names whose values are persisted in keytar.
 */
export const MIGRATION_003 = /* sql */ `
ALTER TABLE servers ADD COLUMN headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE servers ADD COLUMN secret_header_keys TEXT NOT NULL DEFAULT '[]';
`

/**
 * Migration 004 — Adds install metadata columns to the `servers` table.
 * Enables tracking of local server installation status and recipe information.
 */
export const MIGRATION_004 = /* sql */ `
ALTER TABLE servers ADD COLUMN recipe_id TEXT NOT NULL DEFAULT '';
ALTER TABLE servers ADD COLUMN recipe_version TEXT NOT NULL DEFAULT '';
ALTER TABLE servers ADD COLUMN setup_status TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE servers ADD COLUMN last_install_result TEXT NOT NULL DEFAULT '{}';
ALTER TABLE servers ADD COLUMN last_install_timestamp TEXT NOT NULL DEFAULT '';
ALTER TABLE servers ADD COLUMN install_policy TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE servers ADD COLUMN normalized_launch_config TEXT NOT NULL DEFAULT '{}';
`

/**
 * Migration 005 — Creates the `device_setup_state` table for local-only
 * per-device installation state. Never synced across devices.
 */
export const MIGRATION_005 = /* sql */ `
CREATE TABLE device_setup_state (
  device_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  runtime_detection_results TEXT NOT NULL DEFAULT '{}',
  logs TEXT NOT NULL DEFAULT '[]',
  install_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (device_id, server_id)
);
`

/**
 * Migration 006 — Creates the `sync_install_intent` table for syncing
 * installation intent metadata across devices. Contains recipe information
 * and normalized launch config (no secret values).
 */
export const MIGRATION_006 = /* sql */ `
CREATE TABLE sync_install_intent (
  server_id TEXT NOT NULL UNIQUE,
  recipe_id TEXT NOT NULL,
  recipe_version TEXT NOT NULL,
  install_policy TEXT NOT NULL DEFAULT 'manual',
  normalized_launch_config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (server_id)
);
`

/**
 * Migration 007 — Creates the `sync_conflicts` table for storing merge conflicts
 * between local and remote versions of registry entities.
 */
export const MIGRATION_007 = /* sql */ `
CREATE TABLE sync_conflicts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  server_id TEXT,
  server_name TEXT NOT NULL,
  field TEXT NOT NULL,
  local_value TEXT NOT NULL DEFAULT 'null',
  remote_value TEXT NOT NULL DEFAULT 'null',
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_sync_conflicts_resolved ON sync_conflicts(resolved);
CREATE INDEX idx_sync_conflicts_entity_type ON sync_conflicts(entity_type);
`
