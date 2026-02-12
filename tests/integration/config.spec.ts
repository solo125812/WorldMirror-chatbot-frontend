/**
 * Integration test — Configuration service
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Config API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('GET /config should return valid config', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/config',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.server).toBeDefined();
    expect(body.server.port).toBe(3001);
    expect(body.providers).toBeDefined();
    expect(body.prompt).toBeDefined();
    expect(body.prompt.systemPrompt).toBeTruthy();
  });

  it('PATCH /config should update and return new config', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/config',
      payload: {
        prompt: {
          systemPrompt: 'You are a pirate AI.',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.prompt.systemPrompt).toBe('You are a pirate AI.');
  });

  it('PATCH /config should persist changes', async () => {
    // First update
    await app.inject({
      method: 'PATCH',
      url: '/config',
      payload: {
        prompt: {
          systemPrompt: 'Updated prompt',
        },
      },
    });

    // Then verify
    const response = await app.inject({
      method: 'GET',
      url: '/config',
    });

    const body = JSON.parse(response.body);
    expect(body.prompt.systemPrompt).toBe('Updated prompt');
  });
});
