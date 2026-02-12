-- Phase 2 Migration: Initial schema
-- Creates characters, chats, messages, and sampler_presets tables

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL DEFAULT '',
  first_message TEXT NOT NULL DEFAULT '',
  example_messages TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  post_history_instructions TEXT NOT NULL DEFAULT '',
  creator_notes TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',           -- JSON array
  avatar TEXT,
  alternate_greetings TEXT NOT NULL DEFAULT '[]',  -- JSON array
  prompt_assembly_order TEXT,                 -- JSON array or NULL (use profile)
  use_profile_prompt_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  character_id TEXT,
  active_model_id TEXT,
  sampler_preset_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',        -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',        -- JSON (includes swipes array)
  active_swipe_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chats_character_id ON chats(character_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);

CREATE TABLE IF NOT EXISTS sampler_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'user',
  settings TEXT NOT NULL DEFAULT '{}',        -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default sampler presets
INSERT OR IGNORE INTO sampler_presets (id, name, description, source, settings) VALUES
  ('default', 'Default', 'Balanced settings for general use', 'system', json('{"temperature":0.8,"topP":0.95,"topK":40,"maxTokens":1024,"repetitionPenalty":1.1,"presencePenalty":0,"frequencyPenalty":0}')),
  ('creative', 'Creative', 'Higher temperature for creative writing', 'system', json('{"temperature":1.2,"topP":0.98,"topK":100,"maxTokens":2048,"repetitionPenalty":1.05,"presencePenalty":0.1,"frequencyPenalty":0}')),
  ('precise', 'Precise', 'Low temperature for factual responses', 'system', json('{"temperature":0.3,"topP":0.85,"topK":20,"maxTokens":1024,"repetitionPenalty":1.15,"presencePenalty":0,"frequencyPenalty":0.2}')),
  ('deterministic', 'Deterministic', 'Near-zero temperature for reproducible output', 'system', json('{"temperature":0.01,"topP":0.5,"topK":1,"maxTokens":1024,"repetitionPenalty":1.0,"presencePenalty":0,"frequencyPenalty":0}'));
