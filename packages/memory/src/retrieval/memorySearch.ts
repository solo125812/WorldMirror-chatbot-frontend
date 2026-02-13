/**
 * Memory Search — Unified retrieval across vector, keyword, and file-backed memory
 * 
 * Combines:
 * 1. Vector similarity search (semantic)
 * 2. SQLite keyword search
 * 3. File-backed memory search
 * 
 * Ranking formula: cosineSimilarity * 0.7 + recencyScore * 0.2 + importanceScore * 0.1
 */

import type {
  MemorySearchOptions,
  MemorySearchResult,
  MemoryEntry,
  MemoryScope,
} from '@chatbot/types';
import type { MemoryRepo, DocChunkRepo, DocumentRepo } from '@chatbot/db';
import type { EmbeddingProvider } from '../embeddings/embeddingClient.js';
import type { VectorStore } from '../vector/vectorStore.js';
import type { FileMemory } from '../file/fileMemory.js';
import { logger } from '@chatbot/utils';

export interface MemorySearchConfig {
  /** Default number of results to return */
  defaultLimit: number;
  /** Minimum similarity score to include */
  minScore: number;
  /** Maximum age in days for recency scoring */
  recencyWindowDays: number;
}

const DEFAULT_CONFIG: MemorySearchConfig = {
  defaultLimit: 10,
  minScore: 0.3,
  recencyWindowDays: 30,
};

export class MemorySearch {
  private config: MemorySearchConfig;

  constructor(
    private memoryRepo: MemoryRepo,
    private embeddingProvider: EmbeddingProvider,
    private vectorStore: VectorStore,
    private fileMemory: FileMemory | null,
    private docChunkRepo?: DocChunkRepo,
    private documentRepo?: DocumentRepo,
    config?: Partial<MemorySearchConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Search memory across all tiers.
   */
  async search(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    const limit = options.limit ?? this.config.defaultLimit;
    const minScore = options.minScore ?? this.config.minScore;

    const results: MemorySearchResult[] = [];

    // 1. Vector search (semantic)
    try {
      const vectorResults = await this.vectorSearch(options, limit * 2);
      results.push(...vectorResults);
    } catch (error) {
      logger.warn('Vector search failed, falling back to keyword', error);
    }

    // 2. Keyword search (SQLite)
    try {
      const keywordResults = this.keywordSearch(options, limit);
      // Merge without duplicates
      for (const kr of keywordResults) {
        const existingIndex = results.findIndex((r) => r.entry.id === kr.entry.id);
        if (existingIndex === -1) {
          results.push(kr);
        } else if (results[existingIndex].score < kr.score) {
          results[existingIndex] = kr;
        }
      }
    } catch (error) {
      logger.warn('Keyword search failed', error);
    }

    // 3. File-backed memory search
    if (this.fileMemory) {
      try {
        const fileResults = this.fileSearch(options, limit);
        for (const fr of fileResults) {
          const existingIndex = results.findIndex((r) => r.entry.id === fr.entry.id);
          if (existingIndex === -1) {
            results.push(fr);
          } else if (results[existingIndex].score < fr.score) {
            results[existingIndex] = fr;
          }
        }
      } catch (error) {
        logger.warn('File memory search failed', error);
      }
    }

    // Apply combined ranking
    const ranked = this.rankResults(results);

    // Filter by minimum score and limit
    return ranked
      .filter((r) => r.score >= minScore)
      .slice(0, limit);
  }

  /**
   * Vector-based semantic search.
   */
  private async vectorSearch(
    options: MemorySearchOptions,
    limit: number
  ): Promise<MemorySearchResult[]> {
    // Embed the query
    const { embeddings } = await this.embeddingProvider.embed([options.query]);
    if (embeddings.length === 0) return [];

    const queryVector = embeddings[0];

    // Build metadata filter
    const filter: Record<string, unknown> = {};
    if (options.scope) filter.scope = options.scope;
    if (options.sourceId) filter.sourceId = options.sourceId;
    if (options.category) filter.category = options.category;

    // Search vector store
    const vectorResults = this.vectorStore.search(
      queryVector,
      limit,
      Object.keys(filter).length > 0 ? filter : undefined
    );

    // Look up full entries from SQLite
    const results: MemorySearchResult[] = [];
    for (const vr of vectorResults) {
      const entryId = vr.metadata.entryId as string;
      if (!entryId) continue;

      const metaType = vr.metadata.type as string | undefined;
      const entry = this.memoryRepo.get(entryId);

      if (!entry && this.docChunkRepo) {
        const chunk = this.docChunkRepo.get(entryId);
        if (!chunk) continue;

        const doc = this.documentRepo?.get(chunk.documentId);
        const docLabel = doc ? `Document: ${doc.title}\n` : '';

        results.push({
          entry: {
            id: chunk.id,
            type: 'document',
            category: 'document',
            scope: 'global',
            sourceId: chunk.documentId,
            content: `${docLabel}${chunk.content}`.trim(),
            importance: 0.4,
            autoCaptured: false,
            createdAt: chunk.createdAt,
          },
          score: vr.score,
          source: 'vector',
        });
        continue;
      }

      if (!entry) continue;

      // If vector metadata explicitly marks doc chunks, prefer doc lookup
      if (metaType === 'doc_chunk' && this.docChunkRepo) {
        const chunk = this.docChunkRepo.get(entryId);
        if (chunk) {
          const doc = this.documentRepo?.get(chunk.documentId);
          const docLabel = doc ? `Document: ${doc.title}\n` : '';
          results.push({
            entry: {
              id: chunk.id,
              type: 'document',
              category: 'document',
              scope: 'global',
              sourceId: chunk.documentId,
              content: `${docLabel}${chunk.content}`.trim(),
              importance: 0.4,
              autoCaptured: false,
              createdAt: chunk.createdAt,
            },
            score: vr.score,
            source: 'vector',
          });
          continue;
        }
      }

      results.push({
        entry,
        score: vr.score,
        source: 'vector',
      });
    }

    return results;
  }

  /**
   * SQLite keyword search.
   */
  private keywordSearch(
    options: MemorySearchOptions,
    limit: number
  ): MemorySearchResult[] {
    const entries = this.memoryRepo.searchByContent(options.query, {
      scope: options.scope,
      sourceId: options.sourceId,
      limit,
    });

    const results: MemorySearchResult[] = entries.map((entry) => ({
      entry,
      score: 0.5, // Base score for keyword matches
      source: 'keyword' as const,
    }));

    if (this.docChunkRepo && (!options.scope || options.scope === 'global')) {
      const docChunks = this.docChunkRepo.searchByContent(options.query, {
        documentId: options.sourceId,
        limit,
      });

      for (const chunk of docChunks) {
        const doc = this.documentRepo?.get(chunk.documentId);
        const docLabel = doc ? `Document: ${doc.title}\n` : '';
        results.push({
          entry: {
            id: chunk.id,
            type: 'document',
            category: 'document',
            scope: 'global',
            sourceId: chunk.documentId,
            content: `${docLabel}${chunk.content}`.trim(),
            importance: 0.4,
            autoCaptured: false,
            createdAt: chunk.createdAt,
          },
          score: 0.45,
          source: 'keyword' as const,
        });
      }
    }

    return results;
  }

  /**
   * File-backed memory search.
   */
  private fileSearch(
    options: MemorySearchOptions,
    limit: number
  ): MemorySearchResult[] {
    if (!this.fileMemory) return [];

    const fileResults = this.fileMemory.search(options.query, {
      scope: options.scope,
      sourceId: options.sourceId,
      limit,
    });

    // Convert file results to MemorySearchResult
    return fileResults.map((fr) => {
      const fullContent = this.fileMemory?.getEntryContent(fr.id);
      return {
        entry: {
          id: fr.id,
          type: 'memory' as const,
          category: fr.category,
          scope: fr.scope,
          sourceId: fr.sourceId,
          content: fullContent ?? fr.preview,
          importance: 0.5,
          autoCaptured: false,
          createdAt: fr.createdAt,
        },
        score: 0.4, // Base score for file matches (lower than keyword)
        source: 'file' as const,
      };
    });
  }

  /**
   * Apply combined ranking formula:
   * finalScore = vectorScore * 0.7 + recencyScore * 0.2 + importanceScore * 0.1
   */
  private rankResults(results: MemorySearchResult[]): MemorySearchResult[] {
    const now = Date.now();
    const windowMs = this.config.recencyWindowDays * 24 * 60 * 60 * 1000;

    const ranked = results.map((r) => {
      const ageMs = now - new Date(r.entry.createdAt).getTime();
      const recencyScore = Math.max(0, 1 - ageMs / windowMs);
      const importanceScore = r.entry.importance ?? 0.5;
      const vectorScore = r.score;

      const finalScore =
        vectorScore * 0.7 + recencyScore * 0.2 + importanceScore * 0.1;

      return { ...r, score: finalScore };
    });

    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }
}

/**
 * Format memory search results as a compact context block for prompt injection.
 */
export function formatMemoryContext(results: MemorySearchResult[]): string {
  if (results.length === 0) return '';

  const lines = results.map((r, i) => {
    const label = `[${r.entry.category}${r.entry.scope !== 'global' ? ` (${r.entry.scope})` : ''}]`;
    return `${i + 1}. ${label} ${r.entry.content}`;
  });

  return [
    '## Relevant Memory',
    '',
    ...lines,
  ].join('\n');
}
