/**
 * Integration tests — Characters API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Characters API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should validate required name on create', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/characters',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('should create, update, export, and delete a character', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/characters',
      payload: {
        name: 'Test Character',
        description: 'Initial description',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Test Character');

    const listRes = await app.inject({
      method: 'GET',
      url: '/characters',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(Array.isArray(listBody.characters)).toBe(true);
    expect(listBody.characters.some((c: any) => c.id === created.id)).toBe(true);

    const getRes = await app.inject({
      method: 'GET',
      url: `/characters/${created.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.body);
    expect(fetched.description).toBe('Initial description');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/characters/${created.id}`,
      payload: { description: 'Updated description' },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = JSON.parse(patchRes.body);
    expect(updated.description).toBe('Updated description');

    const exportRes = await app.inject({
      method: 'GET',
      url: `/characters/${created.id}/export`,
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers['content-type']).toContain('application/json');
    const exported = JSON.parse(exportRes.body);
    expect(exported.data?.name).toBe('Test Character');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/characters/${created.id}`,
    });
    expect(deleteRes.statusCode).toBe(200);

    const missingRes = await app.inject({
      method: 'GET',
      url: `/characters/${created.id}`,
    });
    expect(missingRes.statusCode).toBe(404);
  });

  it('should import a character card (JSON)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/characters/import',
      headers: { 'content-type': 'application/json' },
      payload: {
        name: 'Imported Character',
        first_mes: 'Hello there!',
        description: 'Imported description',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.name).toBe('Imported Character');
  });
});
