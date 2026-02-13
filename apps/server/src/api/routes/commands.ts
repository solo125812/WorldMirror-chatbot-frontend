/**
 * Commands API Routes — list commands for autocomplete
 * Phase 7 — Week 21
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BUILTIN_COMMANDS } from '@chatbot/core';

export async function commandRoutes(app: FastifyInstance) {
  /**
   * List all available commands (for autocomplete)
   */
  app.get('/commands', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      items: BUILTIN_COMMANDS,
      total: BUILTIN_COMMANDS.length,
    });
  });
}
