-- Phase 4 Migration: Group Chat & Multi-Character
-- Creates group_chats and chat_group_bindings tables

CREATE TABLE IF NOT EXISTS group_chats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  character_ids TEXT NOT NULL DEFAULT '[]',     -- JSON array of character IDs
  activation_strategy TEXT NOT NULL DEFAULT 'sequential'
    CHECK (activation_strategy IN ('sequential', 'random', 'smart')),
  allow_self_responses INTEGER NOT NULL DEFAULT 0,
  reply_order TEXT NOT NULL DEFAULT '[]',       -- JSON array of ordered character IDs
  generation_mode TEXT NOT NULL DEFAULT 'one_at_a_time'
    CHECK (generation_mode IN ('one_at_a_time', 'all_at_once')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bind a chat to a group
CREATE TABLE IF NOT EXISTS chat_group_bindings (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES group_chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_group_bindings_chat ON chat_group_bindings(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_bindings_group ON chat_group_bindings(group_id);
