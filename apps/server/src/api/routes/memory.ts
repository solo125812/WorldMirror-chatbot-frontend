/**
 * Memory Routes — API endpoints for memory operations
 * 
 * POST /memory/ingest    — Ingest document, URL, or text
 * GET  /memory/search    — Semantic memory search
 * POST /memory/capture   — Manual memory entry
 * GET  /memory/entries    — List memory entries
 * GET  /memory/documents  — List ingested documents
 * DELETE /memory/:id     — Delete memory entry
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';
import { logger } from '@chatbot/utils';

export async function memoryRoutes(app: FastifyInstance) {
  /**
   * POST /memory/ingest — Ingest a document, URL, or text
   */
  app.post('/memory/ingest', async (request: FastifyRequest, reply: FastifyReply) => {
    const container = getContainer();
    const body = request.body as {
      type: 'file' | 'url' | 'text';
      content?: string;
      url?: string;
      title?: string;
      mimeType?: string;
    };

    if (!body.type) {
      return reply.status(400).send({ error: 'type is required (file, url, or text)' });
    }

    if (body.type === 'text' && !body.content) {
      return reply.status(400).send({ error: 'content is required for text type' });
    }

    if (body.type === 'url' && !body.url) {
      return reply.status(400).send({ error: 'url is required for url type' });
    }

    try {
      const result = await container.documentIngestor.ingest({
        type: body.type,
        content: body.content,
        url: body.url,
        title: body.title,
        mimeType: body.mimeType,
      });

      return reply.status(201).send(result);
    } catch (error) {
      logger.error('Memory ingestion failed', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Ingestion failed',
      });
    }
  });

  /**
   * GET /memory/search — Semantic memory search
   */
  app.get('/memory/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const container = getContainer();
    const query = request.query as {
      q?: string;
      scope?: string;
      sourceId?: string;
      category?: string;
      limit?: string;
    };

    if (!query.q) {
      return reply.status(400).send({ error: 'q (query) parameter is required' });
    }

    try {
      const results = await container.memorySearch.search({
        query: query.q,
        scope: query.scope as any,
        sourceId: query.sourceId,
        category: query.category as any,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      });

      return reply.send({ results, total: results.length });
    } catch (error) {
      logger.error('Memory search failed', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  });

  /**
   * POST /memory/capture — Manual memory entry
   */
  app.post('/memory/capture', async (request: FastifyRequest, reply: FastifyReply) => {
    const container = getContainer();
    const body = request.body as {
      content: string;
      category?: string;
      scope?: string;
      sourceId?: string;
      importance?: number;
    };

    if (!body.content) {
      return reply.status(400).send({ error: 'content is required' });
    }

    try {
      const entry = container.memoryRepo.create({
        type: 'memory',
        category: (body.category as any) ?? 'fact',
        scope: (body.scope as any) ?? 'global',
        sourceId: body.sourceId,
        content: body.content,
        importance: body.importance ?? 0.5,
        autoCaptured: false,
      });

      // Generate embedding and store in vector store
      try {
        const { embeddings } = await container.embeddingProvider.embed([body.content]);
        if (embeddings.length > 0) {
          container.vectorStore.insert(entry.id, embeddings[0], {
            type: 'memory',
            entryId: entry.id,
            category: entry.category,
            scope: entry.scope,
            sourceId: entry.sourceId,
          });
          container.memoryRepo.updateEmbeddingRef(entry.id, entry.id);
        }
      } catch (embedError) {
        logger.warn('Failed to embed manual memory entry', embedError);
      }

      // Write to file-backed memory
      if (container.fileMemory) {
        container.fileMemory.write(entry);
      }

      return reply.status(201).send(entry);
    } catch (error) {
      logger.error('Memory capture failed', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Capture failed',
      });
    }
  });

  /**
   * GET /memory/entries — List memory entries
   */
  app.get('/memory/entries', async (request: FastifyRequest, reply: FastifyReply) => {
    const container = getContainer();
    const query = request.query as {
      scope?: string;
      sourceId?: string;
      category?: string;
      limit?: string;
      offset?: string;
    };

    try {
      const result = container.memoryRepo.list({
        scope: query.scope as any,
        sourceId: query.sourceId,
        category: query.category as any,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return reply.send(result);
    } catch (error) {
      logger.error('Memory list failed', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'List failed',
      });
    }
  });

  /**
   * GET /memory/documents — List ingested documents
   */
  app.get('/memory/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    const container = getContainer();
    const query = request.query as {
      sourceType?: string;
      limit?: string;
      offset?: string;
    };

    try {
      const result = container.documentRepo.list({
        sourceType: query.sourceType,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return reply.send(result);
    } catch (error) {
      logger.error('Document list failed', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'List failed',
      });
    }
  });

  /**
   * DELETE /memory/:id — Delete a memory entry
   */
  app.delete('/memory/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const container = getContainer();
    const { id } = request.params as { id: string };

    try {
      // Delete from vector store
      container.vectorStore.delete(id);

      // Delete from SQLite
      const deleted = container.memoryRepo.delete(id);
      if (!deleted) {
        return reply.status(404).send({ error: 'Memory entry not found' });
      }

      return reply.status(204).send();
    } catch (error) {
      logger.error('Memory delete failed', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Delete failed',
      });
    }
  });
}
