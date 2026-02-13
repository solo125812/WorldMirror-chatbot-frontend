-- Phase 4 Migration: Regex Rules, Variables, and Triggers
-- Creates regex_rules, variables, and triggers tables

CREATE TABLE IF NOT EXISTS regex_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global', 'character')),
  character_id TEXT,
  find_regex TEXT NOT NULL,
  replace_string TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL DEFAULT '[]',          -- JSON array of placements
  flags TEXT NOT NULL DEFAULT 'g',
  rule_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_regex_rules_scope ON regex_rules(scope, character_id);
CREATE INDEX IF NOT EXISTS idx_regex_rules_order ON regex_rules(rule_order);

CREATE TABLE IF NOT EXISTS variables (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global', 'chat')),
  chat_id TEXT,
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_variables_scope_key ON variables(scope, chat_id, key);

CREATE TABLE IF NOT EXISTS triggers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global', 'character')),
  character_id TEXT,
  activation TEXT NOT NULL DEFAULT 'before_generation'
    CHECK (activation IN (
      'before_generation', 'after_generation',
      'on_user_input', 'on_display', 'manual'
    )),
  conditions TEXT NOT NULL DEFAULT '[]',          -- JSON array of TriggerCondition
  effects TEXT NOT NULL DEFAULT '[]',             -- JSON array of TriggerEffect
  trigger_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_triggers_scope ON triggers(scope, character_id);
CREATE INDEX IF NOT EXISTS idx_triggers_activation ON triggers(activation);
CREATE INDEX IF NOT EXISTS idx_triggers_order ON triggers(trigger_order);
