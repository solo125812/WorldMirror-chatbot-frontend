-- Phase 5: Indexer workspace + file hash columns

ALTER TABLE code_chunks ADD COLUMN workspace_path TEXT DEFAULT '';
ALTER TABLE code_chunks ADD COLUMN file_hash TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_code_chunks_workspace ON code_chunks(workspace_path);
