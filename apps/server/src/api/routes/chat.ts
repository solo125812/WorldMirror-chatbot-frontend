/**
 * Chat routes — POST /chat, POST /chat/stream
 */

import type { FastifyInstance } from 'fastify';
import { getContainer } from '../../di/container.js';
import { formatSSE } from '@chatbot/core';

export async function chatRoutes(app: FastifyInstance) {
  /**
   * POST /chat — Non-streaming chat response
   * Body: { chatId?: string, message: string, characterId?: string }
   */
  app.post('/chat', async (request, reply) => {
    const { chatService } = getContainer();
    const body = request.body as { chatId?: string; message: string; characterId?: string };

    if (!body.message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    const result = await chatService.send({
      message: body.message,
      chatId: body.chatId,
      characterId: body.characterId,
    });

    return {
      chatId: result.chatId,
      message: result.message,
    };
  });

  /**
   * POST /chat/stream — SSE streaming chat response
   * Body: { chatId?: string, message: string, characterId?: string }
   */
  app.post('/chat/stream', async (request, reply) => {
    const { chatService, chatRepo } = getContainer();
    const body = request.body as { chatId?: string; message: string; characterId?: string };

    if (!body.message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    const ensuredChatId = body.chatId ?? chatRepo.createChat({
      characterId: body.characterId,
    }).id;

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Chat-Id': ensuredChatId,
    });

    // Stream response
    try {
      for await (const chunk of chatService.stream({
        message: body.message,
        chatId: ensuredChatId,
        characterId: body.characterId,
      })) {
        if (chunk.type === 'meta' && chunk.value) {
          continue;
        }
        reply.raw.write(formatSSE(chunk as any));
      }

      // Send done event with chatId
      reply.raw.write(formatSSE({ type: 'done', value: ensuredChatId }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.raw.write(formatSSE({ type: 'error', message: errorMessage }));
    }

    reply.raw.end();
  });
}
