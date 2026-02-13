/**
 * Document Ingestor — Pipeline for ingesting documents into the memory system
 * 
 * Steps:
 * 1. Parse/extract text from source (file, URL, text)
 * 2. Chunk the text
 * 3. Generate embeddings for each chunk
 * 4. Store chunks in SQLite + vector store
 */

import type {
  IngestRequest,
  IngestResult,
  Document,
  ChunkOptions,
} from '@chatbot/types';
import type { DocumentRepo, DocChunkRepo } from '@chatbot/db';
import type { EmbeddingProvider } from '../embeddings/embeddingClient.js';
import type { VectorStore } from '../vector/vectorStore.js';
import { chunk as chunkText, estimateTokenCount } from './chunkers.js';
import { logger } from '@chatbot/utils';

export interface DocumentIngestorConfig {
  /** Chunking options */
  chunkOptions?: Partial<ChunkOptions>;
  /** Maximum batch size for embedding requests */
  embeddingBatchSize: number;
}

const DEFAULT_CONFIG: DocumentIngestorConfig = {
  chunkOptions: {
    maxTokens: 800,
    overlap: 120,
    strategy: 'token_window',
  },
  embeddingBatchSize: 32,
};

export class DocumentIngestor {
  private config: DocumentIngestorConfig;

  constructor(
    private documentRepo: DocumentRepo,
    private docChunkRepo: DocChunkRepo,
    private embeddingProvider: EmbeddingProvider,
    private vectorStore: VectorStore,
    config?: Partial<DocumentIngestorConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Ingest a document from various sources.
   */
  async ingest(request: IngestRequest): Promise<IngestResult> {
    logger.info('Starting document ingestion', {
      type: request.type,
      title: request.title,
    });

    // Step 1: Extract text content
    const text = await this.extractText(request);
    if (!text || text.trim().length === 0) {
      throw new Error('No text content extracted from source');
    }

    // Step 2: Create document record
    const doc = this.documentRepo.create({
      title: request.title ?? this.generateTitle(request),
      sourceType: request.type === 'url' ? 'url' : request.type === 'file' ? 'file' : 'text',
      sourceUri: request.url ?? undefined,
      mimeType: request.mimeType ?? 'text/plain',
      sizeBytes: Buffer.byteLength(text, 'utf-8'),
    });

    // Step 3: Chunk the text
    const chunks = chunkText(text, this.config.chunkOptions);
    logger.info(`Document chunked: ${chunks.length} chunks`, { documentId: doc.id });

    // Step 4: Store chunks in SQLite
    const chunkPayloads = chunks.map((c) => ({
      documentId: doc.id,
      content: c.content,
      chunkIndex: c.index,
      tokenCount: c.tokenCount,
      metadata: c.metadata,
    }));

    const storedChunks = this.docChunkRepo.createBatch(chunkPayloads);

    // Step 5: Generate embeddings and store in vector store
    let embeddingsGenerated = 0;
    const batchSize = this.config.embeddingBatchSize;

    for (let i = 0; i < storedChunks.length; i += batchSize) {
      const batch = storedChunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.content);

      try {
        const { embeddings } = await this.embeddingProvider.embed(texts);

        for (let j = 0; j < batch.length; j++) {
          const chunkId = batch[j].id;
          const vector = embeddings[j];

          // Store in vector store
          this.vectorStore.insert(chunkId, vector, {
            type: 'doc_chunk',
            documentId: doc.id,
            chunkIndex: batch[j].chunkIndex,
            entryId: chunkId,
            scope: 'global',
            category: 'document',
          });

          // Update embedding ref in SQLite
          this.docChunkRepo.updateEmbeddingRef(chunkId, chunkId);
          embeddingsGenerated++;
        }
      } catch (error) {
        logger.error('Embedding batch failed', {
          documentId: doc.id,
          batchStart: i,
          error,
        });
      }
    }

    // Update document chunk count
    this.documentRepo.updateChunkCount(doc.id, storedChunks.length);

    logger.info('Document ingestion complete', {
      documentId: doc.id,
      chunks: storedChunks.length,
      embeddings: embeddingsGenerated,
    });

    return {
      document: this.documentRepo.get(doc.id)!,
      chunks: storedChunks.length,
      embeddings: embeddingsGenerated,
    };
  }

  /**
   * Extract text content from the request source.
   */
  private async extractText(request: IngestRequest): Promise<string> {
    switch (request.type) {
      case 'text':
        return request.content ?? '';

      case 'url':
        return this.fetchUrl(request.url!);

      case 'file':
        // File content should be passed directly as content
        return request.content ?? '';

      default:
        throw new Error(`Unsupported ingest type: ${request.type}`);
    }
  }

  /**
   * Fetch and extract text from a URL.
   */
  private async fetchUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WorldMirror/1.0 (Memory Ingestion)',
          Accept: 'text/html,text/plain,application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      const text = await response.text();

      if (contentType.includes('text/html')) {
        return this.extractTextFromHtml(text);
      }

      return text;
    } catch (error) {
      throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract readable text from HTML (simple extraction).
   */
  private extractTextFromHtml(html: string): string {
    // Remove script, style, and other non-content elements
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    return text;
  }

  /**
   * Generate a title from the request if none provided.
   */
  private generateTitle(request: IngestRequest): string {
    if (request.url) {
      try {
        const url = new URL(request.url);
        return url.hostname + url.pathname;
      } catch {
        return request.url.slice(0, 100);
      }
    }
    if (request.content) {
      return request.content.slice(0, 50).replace(/\n/g, ' ') + '...';
    }
    return `Document ${new Date().toISOString()}`;
  }
}
