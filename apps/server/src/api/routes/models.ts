/**
 * Models route — GET /models
 */

import type { FastifyInstance } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function modelsRoutes(app: FastifyInstance) {
  app.get('/models', async (_request, _reply) => {
    const { providerRegistry } = getContainer();
    const models = await providerRegistry.listAllModels();
    return { models };
  });

  app.get('/models/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { providerRegistry } = getContainer();
    const models = await providerRegistry.listAllModels();
    const model = models.find((m) => m.id === id);

    if (!model) {
      return reply.status(404).send({ error: 'Model not found' });
    }

    return model;
  });
}
