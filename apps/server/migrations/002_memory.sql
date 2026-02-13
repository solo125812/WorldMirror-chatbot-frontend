-- Phase 3: Memory and RAG tables
-- Migration: 002_memory.sql

-- Memory entries: stores all memory items (summaries, entities, preferences, facts, etc.)
CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'memory',          -- memory, summary, entity, document
  category TEXT NOT NULL DEFAULT 'fact',          -- summary, entity, preference, decision, fact, document, code, auto_captured
  scope TEXT NOT NULL DEFAULT 'global',           -- global, character, chat
  source_id TEXT,                                  -- character_id or chat_id depending on scope
  content TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,           -- 0.0–1.0 importance score
  embedding_ref TEXT,                              -- reference to vector store entry
  auto_captured INTEGER NOT NULL DEFAULT 0,       -- 1 if auto-captured, 0 if manual
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_entries_scope ON memory_entries(scope, source_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_category ON memory_entries(category);
CREATE INDEX IF NOT EXISTS idx_memory_entries_type ON memory_entries(type);
CREATE INDEX IF NOT EXISTS idx_memory_entries_created_at ON memory_entries(created_at);

-- Documents: tracks ingested documents
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'file',       -- file, url, youtube, text
  source_uri TEXT,                                 -- file path, URL, or YouTube URL
  mime_type TEXT,                                   -- text/plain, text/markdown, application/pdf, etc.
  size_bytes INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

-- Document chunks: stores chunked document content for RAG
CREATE TABLE IF NOT EXISTS doc_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER DEFAULT 0,
  embedding_ref TEXT,                              -- reference to vector store entry
  metadata TEXT,                                    -- JSON: heading path, code language, etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_document_id ON doc_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_chunk_index ON doc_chunks(document_id, chunk_index);
