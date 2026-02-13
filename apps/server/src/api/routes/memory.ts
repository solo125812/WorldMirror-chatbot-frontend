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
    const contentType = request.headers['content-type'] ?? '';
    let payload: {
      type: 'file' | 'url' | 'text';
      content?: string;
      url?: string;
      title?: string;
      mimeType?: string;
    };

    if (contentType.includes('multipart/form-data')) {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const filename = (data.filename ?? 'upload').toLowerCase();
      const mimeType = data.mimetype ?? 'text/plain';
      const fields = data.fields as Record<string, { value?: unknown }> | undefined;
      const titleField =
        typeof fields?.title?.value === 'string' ? fields?.title?.value : undefined;

      const isText =
        mimeType.startsWith('text/') ||
        filename.endsWith('.txt') ||
        filename.endsWith('.md') ||
        filename.endsWith('.markdown');

      if (!isText) {
        return reply
          .status(415)
          .send({ error: 'Unsupported file type. Use .txt or .md' });
      }

      payload = {
        type: 'file',
        content: buffer.toString('utf-8'),
        title: titleField ?? data.filename ?? 'Uploaded file',
        mimeType,
      };
    } else {
      const body = request.body as {
        type?: 'file' | 'url' | 'text';
        content?: string;
        url?: string;
        title?: string;
        mimeType?: string;
      };

      if (!body.type) {
        return reply
          .status(400)
          .send({ error: 'type is required (file, url, or text)' });
      }

      if (body.type === 'text' && !body.content) {
        return reply.status(400).send({ error: 'content is required for text type' });
      }

      if (body.type === 'url' && !body.url) {
        return reply.status(400).send({ error: 'url is required for url type' });
      }

      if (body.type === 'file' && !body.content) {
        return reply
          .status(400)
          .send({ error: 'content is required for file type (or use multipart)' });
      }

      payload = {
        type: body.type,
        content: body.content,
        url: body.url,
        title: body.title,
        mimeType: body.mimeType,
      };
    }

    try {
      const result = await container.documentIngestor.ingest({
        type: payload.type,
        content: payload.content,
        url: payload.url,
        title: payload.title,
        mimeType: payload.mimeType,
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
   * DELETE /memory/documents/:id — Delete an ingested document
   */
  app.delete('/memory/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const container = getContainer();
    const { id } = request.params as { id: string };

    try {
      const doc = container.documentRepo.get(id);
      if (!doc) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      // Remove vectors for doc chunks
      container.vectorStore.deleteByMetadata('documentId', id);

      // Remove chunks + document rows
      container.docChunkRepo.deleteByDocument(id);
      container.documentRepo.delete(id);

      return reply.send({ success: true });
    } catch (error) {
      logger.error('Document delete failed', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Delete failed',
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

      // Delete from file-backed memory index
      if (container.fileMemory) {
        container.fileMemory.deleteEntry(id);
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
