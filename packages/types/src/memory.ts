/**
 * Memory and RAG type definitions — Phase 3
 */

// ── Memory Entry ────────────────────────────────────────────────────

export type MemoryType = 'memory' | 'summary' | 'entity' | 'document';

export type MemoryCategory =
  | 'summary'
  | 'entity'
  | 'preference'
  | 'decision'
  | 'fact'
  | 'document'
  | 'code'
  | 'auto_captured';

export type MemoryScope = 'global' | 'character' | 'chat';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  category: MemoryCategory;
  scope: MemoryScope;
  sourceId?: string;
  content: string;
  importance: number;
  embeddingRef?: string;
  autoCaptured: boolean;
  createdAt: string;
}

export interface CreateMemoryEntryPayload {
  type?: MemoryType;
  category?: MemoryCategory;
  scope?: MemoryScope;
  sourceId?: string;
  content: string;
  importance?: number;
  embeddingRef?: string;
  autoCaptured?: boolean;
}

// ── Documents ───────────────────────────────────────────────────────

export type DocumentSourceType = 'file' | 'url' | 'youtube' | 'text';

export interface Document {
  id: string;
  title: string;
  sourceType: DocumentSourceType;
  sourceUri?: string;
  mimeType?: string;
  sizeBytes: number;
  chunkCount: number;
  createdAt: string;
}

export interface CreateDocumentPayload {
  title: string;
  sourceType: DocumentSourceType;
  sourceUri?: string;
  mimeType?: string;
  sizeBytes?: number;
}

// ── Document Chunks ─────────────────────────────────────────────────

export interface DocChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  embeddingRef?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateDocChunkPayload {
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount?: number;
  embeddingRef?: string;
  metadata?: Record<string, unknown>;
}

// ── Memory Search ───────────────────────────────────────────────────

export interface MemorySearchOptions {
  query: string;
  scope?: MemoryScope;
  sourceId?: string;
  category?: MemoryCategory;
  limit?: number;
  minScore?: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  source: 'vector' | 'keyword' | 'file';
}

// ── Embedding ───────────────────────────────────────────────────────

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  tokenCount: number;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'ollama' | 'local';
  model: string;
  baseUrl?: string;
  apiKey?: string;
  dimensions?: number;
}

// ── Vector Store ────────────────────────────────────────────────────

export interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

// ── Auto-Capture ────────────────────────────────────────────────────

export interface AutoCaptureConfig {
  enabled: boolean;
  maxPerTurn: number;
  deduplicationThreshold: number;
  triggers: AutoCaptureTrigger[];
}

export interface AutoCaptureTrigger {
  id: string;
  name: string;
  pattern: string;
  category: MemoryCategory;
  enabled: boolean;
}

// ── Ingestion ───────────────────────────────────────────────────────

export interface IngestRequest {
  type: 'file' | 'url' | 'text';
  content?: string;         // for text type
  url?: string;             // for url type
  title?: string;
  mimeType?: string;
}

export interface IngestResult {
  document: Document;
  chunks: number;
  embeddings: number;
}

// ── Chunking ────────────────────────────────────────────────────────

export interface ChunkOptions {
  maxTokens: number;
  overlap: number;
  strategy: 'token_window' | 'markdown';
}

export interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

// ── Context Compaction ──────────────────────────────────────────────

export interface CompactionEvent {
  timestamp: string;
  messagesBefore: number;
  messagesAfter: number;
  tokensBefore: number;
  tokensAfter: number;
  summary: string;
}

export interface CompactionConfig {
  enabled: boolean;
  threshold: number;         // 0.0–1.0, default 0.8 (80% of context window)
  preserveRecentMessages: number;  // number of recent messages to keep
}
