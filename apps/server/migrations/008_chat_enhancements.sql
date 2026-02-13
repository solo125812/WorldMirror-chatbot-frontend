-- Phase 7: Chat Enhancements — Branching, Checkpoints, Quick Replies
-- Migration 008

-- Add branch metadata columns to chats table
ALTER TABLE chats ADD COLUMN parent_chat_id TEXT REFERENCES chats(id) ON DELETE SET NULL;
ALTER TABLE chats ADD COLUMN branch_point_message_id TEXT;
ALTER TABLE chats ADD COLUMN root_chat_id TEXT;
ALTER TABLE chats ADD COLUMN branch_label TEXT;

CREATE INDEX IF NOT EXISTS idx_chats_parent ON chats(parent_chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_root ON chats(root_chat_id);

-- Chat checkpoints table
CREATE TABLE IF NOT EXISTS chat_checkpoints (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_chat ON chat_checkpoints(chat_id);

-- Quick reply sets
CREATE TABLE IF NOT EXISTS quick_reply_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK(scope IN ('global', 'character')),
  character_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_qr_sets_scope ON quick_reply_sets(scope);
CREATE INDEX IF NOT EXISTS idx_qr_sets_character ON quick_reply_sets(character_id);

-- Quick reply items
CREATE TABLE IF NOT EXISTS quick_reply_items (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES quick_reply_sets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  command TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_qr_items_set ON quick_reply_items(set_id);
