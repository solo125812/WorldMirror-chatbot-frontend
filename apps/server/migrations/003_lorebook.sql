-- Phase 4 Migration: Lorebook / World Info system
-- Creates lorebooks, lorebook_entries, lorebook_bindings, and lorebook_assets tables

CREATE TABLE IF NOT EXISTS lorebooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  scan_depth INTEGER NOT NULL DEFAULT 5,
  recursive_scan INTEGER NOT NULL DEFAULT 0,
  case_sensitive INTEGER NOT NULL DEFAULT 0,
  match_whole_words INTEGER NOT NULL DEFAULT 0,
  use_group_scoring INTEGER NOT NULL DEFAULT 0,
  budget_tokens INTEGER NOT NULL DEFAULT 2048,
  min_activations INTEGER NOT NULL DEFAULT 0,
  max_recursion_steps INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lorebook_entries (
  id TEXT PRIMARY KEY,
  lorebook_id TEXT NOT NULL,
  keys TEXT NOT NULL DEFAULT '[]',              -- JSON array of trigger keywords
  secondary_keys TEXT NOT NULL DEFAULT '[]',    -- JSON array of secondary keywords
  content TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  position TEXT NOT NULL DEFAULT 'before_persona'
    CHECK (position IN (
      'before_system', 'after_system',
      'before_persona', 'after_persona',
      'before_author', 'after_author',
      'before_history', 'after_history'
    )),
  insertion_order INTEGER NOT NULL DEFAULT 100,
  case_sensitive INTEGER NOT NULL DEFAULT 0,
  match_whole_words INTEGER NOT NULL DEFAULT 0,
  regex INTEGER NOT NULL DEFAULT 0,
  constant INTEGER NOT NULL DEFAULT 0,
  selective INTEGER NOT NULL DEFAULT 0,
  exclude_recursion INTEGER NOT NULL DEFAULT 0,
  group_id TEXT,
  cooldown_turns INTEGER,
  delay_turns INTEGER,
  sticky_turns INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lorebook_entries_lorebook_id ON lorebook_entries(lorebook_id);
CREATE INDEX IF NOT EXISTS idx_lorebook_entries_insertion_order ON lorebook_entries(insertion_order);

CREATE TABLE IF NOT EXISTS lorebook_bindings (
  id TEXT PRIMARY KEY,
  lorebook_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global', 'character', 'chat')),
  source_id TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lorebook_bindings_scope ON lorebook_bindings(scope, source_id);

CREATE TABLE IF NOT EXISTS lorebook_assets (
  id TEXT PRIMARY KEY,
  lorebook_id TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'misc',
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lorebook_id) REFERENCES lorebooks(id) ON DELETE CASCADE
);
