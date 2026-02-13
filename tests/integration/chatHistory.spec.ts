/**
 * Integration tests — Chat History API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Chat History API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should list, fetch, and delete chats', async () => {
    const chatRes = await app.inject({
      method: 'POST',
      url: '/chat',
      payload: { message: 'Hello history' },
    });
    expect(chatRes.statusCode).toBe(200);
    const chatBody = JSON.parse(chatRes.body);
    const chatId = chatBody.chatId;

    const listRes = await app.inject({
      method: 'GET',
      url: '/chats',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.chats.some((c: any) => c.id === chatId)).toBe(true);

    const getRes = await app.inject({
      method: 'GET',
      url: `/chats/${chatId}`,
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(Array.isArray(getBody.messages)).toBe(true);
    expect(getBody.messages.length).toBeGreaterThan(0);

    const messagesRes = await app.inject({
      method: 'GET',
      url: `/chats/${chatId}/messages?limit=10`,
    });
    expect(messagesRes.statusCode).toBe(200);
    const messagesBody = JSON.parse(messagesRes.body);
    expect(Array.isArray(messagesBody.messages)).toBe(true);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/chats/${chatId}`,
    });
    expect(deleteRes.statusCode).toBe(200);

    const missingRes = await app.inject({
      method: 'GET',
      url: `/chats/${chatId}`,
    });
    expect(missingRes.statusCode).toBe(404);
  });
});
