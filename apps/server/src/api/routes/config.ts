/**
 * Config routes — GET /config, PATCH /config
 */

import type { FastifyInstance } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function configRoutes(app: FastifyInstance) {
  app.get('/config', async (_request, _reply) => {
    const { configService } = getContainer();
    return configService.get();
  });

  app.patch('/config', async (request, _reply) => {
    const { configService } = getContainer();
    const patch = request.body as Record<string, unknown>;
    const updated = configService.update(patch);
    return updated;
  });
}
