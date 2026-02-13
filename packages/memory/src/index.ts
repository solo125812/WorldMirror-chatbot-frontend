/**
 * @chatbot/memory — Memory and RAG system
 * 
 * Phase 3: Two-tier memory (file-backed + vector), document ingestion,
 * retrieval, auto-capture, and context compaction.
 */

// Ingestion
export { chunk, chunkByTokenWindow, chunkByMarkdown, estimateTokenCount } from './ingest/chunkers.js';
export { DocumentIngestor } from './ingest/documentIngestor.js';
export type { DocumentIngestorConfig } from './ingest/documentIngestor.js';

// Embeddings
export {
  createEmbeddingProvider,
  OpenAIEmbeddingProvider,
  OllamaEmbeddingProvider,
} from './embeddings/embeddingClient.js';
export type { EmbeddingProvider } from './embeddings/embeddingClient.js';

// Vector Store
export { InMemoryVectorStore, createVectorStore } from './vector/vectorStore.js';
export type { VectorStore, VectorStoreConfig } from './vector/vectorStore.js';

// File-backed Memory
export { FileMemory } from './file/fileMemory.js';
export type { FileMemoryConfig, FileMemoryIndex, FileMemoryIndexEntry } from './file/fileMemory.js';

// Retrieval
export { MemorySearch, formatMemoryContext } from './retrieval/memorySearch.js';
export type { MemorySearchConfig } from './retrieval/memorySearch.js';

// Auto-Capture
export {
  AutoCaptureService,
  scanForCaptures,
  DEFAULT_TRIGGERS,
  DEFAULT_AUTO_CAPTURE_CONFIG,
} from './autocapture/autoCapture.js';
export type { CapturedMemory } from './autocapture/autoCapture.js';

// Summarization
export {
  ContextCompactor,
  needsCompaction,
  heuristicSummarize,
  estimateMessagesTokens,
  DEFAULT_COMPACTION_CONFIG,
} from './summarization/summarizer.js';
