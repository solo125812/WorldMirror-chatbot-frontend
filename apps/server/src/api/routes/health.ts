/**
 * Health route — GET /health
 */

import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, _reply) => {
    return { ok: true, timestamp: new Date().toISOString() };
  });
}
