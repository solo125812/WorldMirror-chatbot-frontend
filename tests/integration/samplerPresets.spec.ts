/**
 * Integration tests — Sampler Presets API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Sampler Presets API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should list presets including default', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/sampler-presets',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.presets)).toBe(true);
    expect(body.presets.some((p: any) => p.id === 'default')).toBe(true);
  });

  it('should validate required fields on create', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sampler-presets',
      payload: { name: 'Invalid' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should create, update, and delete a user preset', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/sampler-presets',
      payload: {
        name: 'Test Preset',
        description: 'Custom preset',
        settings: { temperature: 0.9, topP: 0.95 },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Test Preset');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/sampler-presets/${created.id}`,
      payload: { description: 'Updated preset' },
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = JSON.parse(patchRes.body);
    expect(patched.description).toBe('Updated preset');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/sampler-presets/${created.id}`,
    });
    expect(deleteRes.statusCode).toBe(200);
  });

  it('should reject updates to system presets', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/sampler-presets/default',
      payload: { description: 'Nope' },
    });

    expect(response.statusCode).toBe(400);
  });
});
