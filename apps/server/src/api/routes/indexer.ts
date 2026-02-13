/**
 * Code indexer routes — §10
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function indexerRoutes(app: FastifyInstance) {
  // GET /indexer/status — Get current indexing status
  app.get('/indexer/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { codeIndexer } = getContainer();
    const status = codeIndexer.getStatus();
    return reply.send(status);
  });

  // POST /indexer/scan — Start an indexing job
  app.post('/indexer/scan', async (request: FastifyRequest, reply: FastifyReply) => {
    const { codeIndexer } = getContainer();
    const body = request.body as any;

    if (!body?.workspacePath) {
      return reply.status(400).send({ error: 'workspacePath is required' });
    }

    try {
      const job = await codeIndexer.startJob(body.workspacePath, {
        mode: body.mode,
        ignorePatterns: body.ignorePatterns,
      });
      return reply.status(202).send(job);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Failed to start indexing',
      });
    }
  });

  // POST /indexer/stop — Stop the current indexing job
  app.post('/indexer/stop', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { codeIndexer } = getContainer();
    const stopped = codeIndexer.stopJob();
    return reply.send({ stopped });
  });

  // GET /indexer/search — Search indexed code
  app.get('/indexer/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { codeIndexer } = getContainer();
    const query = request.query as any;

    if (!query?.query) {
      return reply.status(400).send({ error: 'query parameter is required' });
    }

    try {
      const results = await codeIndexer.search({
        query: query.query,
        workspacePath: query.workspacePath,
        language: query.language,
        topK: query.topK ? parseInt(query.topK, 10) : undefined,
      });
      return reply.send({ results });
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  });

  // GET /indexer/jobs — List indexing jobs
  app.get('/indexer/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const { indexJobRepo } = getContainer();
    const query = request.query as any;
    const result = indexJobRepo.list({
      status: query.status,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    return reply.send(result);
  });

  // GET /indexer/jobs/:id — Get a specific indexing job
  app.get('/indexer/jobs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { indexJobRepo } = getContainer();
    const { id } = request.params as { id: string };
    const job = indexJobRepo.get(id);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    return reply.send(job);
  });
}
