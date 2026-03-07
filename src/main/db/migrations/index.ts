/**
 * @file src/main/db/migrations/index.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Exports all SQLite migration scripts as typed string constants.
 * Keeping them here avoids file-path resolution issues across dev, test, and
 * packaged Electron builds — no readFileSync or path gymnastics needed.
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
