/**
 * Fastify App — creates and configures the server instance
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { healthRoutes } from './api/routes/health.js';
import { modelsRoutes } from './api/routes/models.js';
import { configRoutes } from './api/routes/config.js';
import { chatRoutes } from './api/routes/chat.js';
import { characterRoutes } from './api/routes/characters.js';
import { chatHistoryRoutes } from './api/routes/chats.js';
import { samplerPresetRoutes } from './api/routes/samplerPresets.js';
import { createContainer } from './di/container.js';
import { logger } from '@chatbot/utils';

export async function buildApp() {
  // Initialize DI container
  createContainer();

  const app = Fastify({
    logger: false, // We use our own logger
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Register multipart for file uploads (character cards)
  await app.register(multipart);

  // Register routes
  await app.register(healthRoutes);
  await app.register(modelsRoutes);
  await app.register(configRoutes);
  await app.register(chatRoutes);
  await app.register(characterRoutes);
  await app.register(chatHistoryRoutes);
  await app.register(samplerPresetRoutes);

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { statusCode?: number };
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    reply.status(err.statusCode ?? 500).send({
      error: err.message ?? 'Internal Server Error',
    });
  });

  return app;
}
