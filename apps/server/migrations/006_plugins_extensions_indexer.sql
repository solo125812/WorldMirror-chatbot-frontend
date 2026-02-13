-- Phase 5: Plugins, Extensions, and Code Indexing tables

-- Installed plugins
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  entry TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  permissions TEXT NOT NULL DEFAULT '[]',
  config_schema TEXT,
  plugin_config TEXT,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Plugin permission grants
CREATE TABLE IF NOT EXISTS plugin_permissions (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 0,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(plugin_id, permission)
);

-- Installed extensions
CREATE TABLE IF NOT EXISTS extensions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '0.0.0',
  description TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'git',
  scope TEXT NOT NULL DEFAULT 'global',
  repo_url TEXT,
  branch TEXT,
  commit_hash TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Code chunks for indexing
CREATE TABLE IF NOT EXISTS code_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'unknown',
  content TEXT NOT NULL,
  line_start INTEGER NOT NULL DEFAULT 0,
  line_end INTEGER NOT NULL DEFAULT 0,
  hash TEXT NOT NULL,
  embedding_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_code_chunks_document ON code_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_code_chunks_file_path ON code_chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_code_chunks_language ON code_chunks(language);

-- Indexing jobs
CREATE TABLE IF NOT EXISTS index_jobs (
  id TEXT PRIMARY KEY,
  workspace_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  mode TEXT NOT NULL DEFAULT 'full',
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_index_jobs_status ON index_jobs(status);
