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
import { memoryRoutes } from './api/routes/memory.js';
import { lorebookRoutes } from './api/routes/lorebooks.js';
import { groupRoutes } from './api/routes/groups.js';
import { skillRoutes } from './api/routes/skills.js';
import { triggerRoutes } from './api/routes/triggers.js';
import { pluginRoutes } from './api/routes/plugins.js';
import { extensionRoutes } from './api/routes/extensions.js';
import { indexerRoutes } from './api/routes/indexer.js';
import { diagnosticsRoutes } from './api/routes/diagnostics.js';
import { createContainer } from './di/container.js';
import { logger, AppError } from '@chatbot/utils';

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
  await app.register(memoryRoutes);
  await app.register(lorebookRoutes);
  await app.register(groupRoutes);
  await app.register(skillRoutes);
  await app.register(triggerRoutes);
  // Phase 5
  await app.register(pluginRoutes);
  await app.register(extensionRoutes);
  await app.register(indexerRoutes);
  // Phase 6
  await app.register(diagnosticsRoutes);

  // Global error handler with AppError support
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      logger.warn(`AppError: ${error.message}`, {
        code: error.code,
        statusCode: error.statusCode,
      });
      return reply.status(error.statusCode).send(error.toJSON());
    }

    const err = error as Error & { statusCode?: number; validation?: unknown };

    // Fastify validation errors
    if (err.validation) {
      logger.warn('Validation error', { message: err.message });
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      });
    }

    // Unhandled errors
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    reply.status(err.statusCode ?? 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message ?? 'Internal Server Error',
      },
    });
  });

  return app;
}
