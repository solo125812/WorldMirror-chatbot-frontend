/**
 * @chatbot/indexer — Codebase indexing engine
 */

export { CodeIndexer } from './indexer.js';
export type { IndexerConfig } from './indexer.js';
export { scanWorkspace, detectLanguage, hashFile, loadIgnorePatterns } from './scanner.js';
export { chunkCode, chunkFile } from './chunker.js';
export type { ChunkConfig } from './chunker.js';
