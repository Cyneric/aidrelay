-- Server registry
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'stdio',
  command TEXT NOT NULL,
  args TEXT NOT NULL DEFAULT '[]',             -- JSON array
  env TEXT NOT NULL DEFAULT '{}',              -- JSON object (non-secret)
  secret_env_keys TEXT NOT NULL DEFAULT '[]',  -- JSON array of key names
  enabled INTEGER NOT NULL DEFAULT 1,
  client_overrides TEXT NOT NULL DEFAULT '{}', -- JSON object
  tags TEXT NOT NULL DEFAULT '[]',             -- JSON array
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Activity log
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,              -- 'server.created', 'sync.performed', etc.
  details TEXT NOT NULL DEFAULT '{}', -- JSON with action-specific data
  client_id TEXT,                    -- NULL for non-client actions
  server_id TEXT                     -- NULL for non-server actions
);

-- Backup history
CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  backup_type TEXT NOT NULL DEFAULT 'sync', -- 'sync', 'pristine', 'manual'
  created_at TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT NOT NULL                   -- SHA-256 for conflict detection
);

-- AI Rules
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,                     -- Markdown rule content
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT NOT NULL DEFAULT '[]',           -- JSON array
  enabled INTEGER NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'normal',   -- 'critical', 'high', 'normal', 'low'
  scope TEXT NOT NULL DEFAULT 'global',      -- 'global' or 'project'
  project_path TEXT,                         -- Only for scope='project'
  file_globs TEXT NOT NULL DEFAULT '[]',     -- JSON array of glob patterns
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
  is_active INTEGER NOT NULL DEFAULT 0,      -- Only one active at a time
  parent_profile_id TEXT,
  server_overrides TEXT NOT NULL DEFAULT '{}', -- JSON
  rule_overrides TEXT NOT NULL DEFAULT '{}',   -- JSON
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
