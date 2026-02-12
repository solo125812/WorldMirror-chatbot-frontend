/**
 * Integration test — SSE chat streaming
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('POST /chat/stream (SSE)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should return SSE stream with token and done events', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/chat/stream',
      payload: { message: 'Hello' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');

    const body = response.body;
    expect(body).toContain('event: token');
    expect(body).toContain('event: done');
  });

  it('should return 400 for missing message', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/chat/stream',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return chat ID in response header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/chat/stream',
      payload: { message: 'Test' },
    });

    expect(response.headers['x-chat-id']).toBeTruthy();
  });
});

describe('POST /chat (non-streaming)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should return a response with chatId and message', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/chat',
      payload: { message: 'Hello' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.chatId).toBeTruthy();
    expect(body.message).toBeTruthy();
    expect(body.message.content).toBeTruthy();
  });
});

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should return ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);
  });
});

describe('GET /models', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should return at least one model', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/models',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.models).toBeDefined();
    expect(body.models.length).toBeGreaterThan(0);
  });
});
