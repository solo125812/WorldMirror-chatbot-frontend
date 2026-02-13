/**
 * Vector Store Adapter — In-memory vector store with cosine similarity search
 * 
 * This is a lightweight, zero-dependency implementation suitable for desktop use.
 * Can be swapped for LanceDB, Qdrant, or other backends in future phases.
 * 
 * Persistence: vectors are serialized to a JSON file on disk.
 */

import type { VectorEntry, VectorSearchResult } from '@chatbot/types';
import { logger } from '@chatbot/utils';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface VectorStoreConfig {
  /** Path to persist vectors on disk. If null, in-memory only. */
  persistPath?: string;
  /** Number of dimensions for vectors */
  dimensions: number;
}

export interface VectorStore {
  insert(id: string, vector: number[], metadata: Record<string, unknown>): void;
  insertBatch(entries: VectorEntry[]): void;
  search(query: number[], topK: number, filter?: Record<string, unknown>): VectorSearchResult[];
  delete(id: string): boolean;
  deleteByMetadata(key: string, value: unknown): number;
  count(): number;
  clear(): void;
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * In-memory vector store with optional disk persistence.
 */
export class InMemoryVectorStore implements VectorStore {
  private entries: Map<string, { vector: number[]; metadata: Record<string, unknown> }> = new Map();
  private persistPath?: string;
  private dimensions: number;
  private dirty = false;

  constructor(config: VectorStoreConfig) {
    this.dimensions = config.dimensions;
    this.persistPath = config.persistPath;

    if (this.persistPath) {
      this.loadFromDisk();
    }
  }

  insert(id: string, vector: number[], metadata: Record<string, unknown>): void {
    if (vector.length !== this.dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`
      );
    }
    this.entries.set(id, { vector, metadata });
    this.dirty = true;
    this.maybePersist();
  }

  insertBatch(entries: VectorEntry[]): void {
    for (const entry of entries) {
      if (entry.vector.length !== this.dimensions) {
        throw new Error(
          `Vector dimension mismatch: expected ${this.dimensions}, got ${entry.vector.length}`
        );
      }
      this.entries.set(entry.id, {
        vector: entry.vector,
        metadata: entry.metadata,
      });
    }
    this.dirty = true;
    this.maybePersist();
  }

  search(
    query: number[],
    topK: number,
    filter?: Record<string, unknown>
  ): VectorSearchResult[] {
    if (query.length !== this.dimensions) {
      throw new Error(
        `Query dimension mismatch: expected ${this.dimensions}, got ${query.length}`
      );
    }

    const results: VectorSearchResult[] = [];

    for (const [id, entry] of this.entries) {
      // Apply metadata filter
      if (filter) {
        let match = true;
        for (const [key, value] of Object.entries(filter)) {
          if (entry.metadata[key] !== value) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      const score = cosineSimilarity(query, entry.vector);
      results.push({ id, score, metadata: entry.metadata });
    }

    // Sort by score descending and return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  delete(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) {
      this.dirty = true;
      this.maybePersist();
    }
    return deleted;
  }

  deleteByMetadata(key: string, value: unknown): number {
    let count = 0;
    for (const [id, entry] of this.entries) {
      if (entry.metadata[key] === value) {
        this.entries.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.dirty = true;
      this.maybePersist();
    }
    return count;
  }

  count(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.dirty = true;
    this.maybePersist();
  }

  /**
   * Force persist to disk (if configured).
   */
  flush(): void {
    if (this.persistPath && this.dirty) {
      this.saveToDisk();
      this.dirty = false;
    }
  }

  private maybePersist(): void {
    // Persist every 100 operations or when batch completes
    if (this.persistPath && this.entries.size % 100 === 0) {
      this.saveToDisk();
      this.dirty = false;
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) return;

    try {
      const dir = dirname(this.persistPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }> = [];
      for (const [id, entry] of this.entries) {
        data.push({ id, vector: entry.vector, metadata: entry.metadata });
      }

      writeFileSync(this.persistPath, JSON.stringify(data), 'utf-8');
      logger.info(`Vector store persisted: ${data.length} entries`);
    } catch (error) {
      logger.error('Failed to persist vector store', error);
    }
  }

  private loadFromDisk(): void {
    if (!this.persistPath || !existsSync(this.persistPath)) return;

    try {
      const raw = readFileSync(this.persistPath, 'utf-8');
      const data = JSON.parse(raw) as Array<{
        id: string;
        vector: number[];
        metadata: Record<string, unknown>;
      }>;

      for (const entry of data) {
        this.entries.set(entry.id, {
          vector: entry.vector,
          metadata: entry.metadata,
        });
      }

      logger.info(`Vector store loaded: ${data.length} entries`);
    } catch (error) {
      logger.error('Failed to load vector store', error);
    }
  }
}

/**
 * Create a vector store instance.
 */
export function createVectorStore(config: VectorStoreConfig): VectorStore {
  return new InMemoryVectorStore(config);
}
