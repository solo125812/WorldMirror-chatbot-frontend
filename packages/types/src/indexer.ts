/**
 * Code indexer types — §10 Codebase Indexing Pipeline
 */

/** Indexing job status */
export type IndexJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Indexing mode */
export type IndexMode = 'full' | 'incremental';

/** Code chunk metadata — §10.3 */
export interface CodeChunkMetadata {
  repoRoot: string;
  filePath: string;
  language: string;
  lineStart: number;
  lineEnd: number;
  chunkId: string;
}

/** A code chunk with content and metadata */
export interface CodeChunk {
  id: string;
  documentId: string;
  workspacePath: string;
  filePath: string;
  language: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  hash: string;
  fileHash: string;
  embeddingRef: string | null;
  createdAt: string;
}

/** Payload to create a code chunk */
export interface CreateCodeChunkPayload {
  documentId: string;
  workspacePath: string;
  filePath: string;
  language: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  hash: string;
  fileHash: string;
}

/** Indexing job record (persisted) */
export interface IndexJob {
  id: string;
  workspacePath: string;
  status: IndexJobStatus;
  mode: IndexMode;
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Payload to start an indexing job */
export interface StartIndexJobPayload {
  workspacePath: string;
  mode?: IndexMode;
  ignorePatterns?: string[];
}

/** Indexing status response */
export interface IndexStatus {
  jobId: string | null;
  status: IndexJobStatus | 'idle';
  workspacePath: string | null;
  progress: {
    totalFiles: number;
    processedFiles: number;
    totalChunks: number;
  } | null;
}

/** Code search request */
export interface CodeSearchRequest {
  query: string;
  workspacePath?: string;
  language?: string;
  topK?: number;
}

/** Code search result */
export interface CodeSearchResult {
  chunkId: string;
  filePath: string;
  language: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  score: number;
}

/** File scan entry discovered by scanner */
export interface ScannedFile {
  path: string;
  relativePath: string;
  language: string;
  size: number;
  hash: string;
}

/** Ignore rule configuration */
export interface IgnoreConfig {
  patterns: string[];
  sources: Array<'user' | '.rooignore' | '.gitignore'>;
}
