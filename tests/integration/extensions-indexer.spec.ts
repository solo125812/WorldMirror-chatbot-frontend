/**
 * Integration tests — Extension and Indexer API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Extension API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should list extensions (empty initially) via GET /extensions', async () => {
    const res = await app.inject({ method: 'GET', url: '/extensions' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('should require url on install via POST /extensions/install', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/extensions/install',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('url');
  });

  it('should return 404 for missing extension via GET /extensions/:name', async () => {
    const res = await app.inject({ method: 'GET', url: '/extensions/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('should return 404 when uninstalling missing extension via DELETE /extensions/:name', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/extensions/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('should require name on update via POST /extensions/update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/extensions/update',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should require name on branches via POST /extensions/branches', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/extensions/branches',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should check for updates via POST /extensions/check-updates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/extensions/check-updates',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.updates).toEqual([]);
  });
});

describe('Indexer API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should report idle status via GET /indexer/status', async () => {
    const res = await app.inject({ method: 'GET', url: '/indexer/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('idle');
    expect(body.jobId).toBeNull();
    expect(body.workspacePath).toBeNull();
    expect(body.progress).toBeNull();
  });

  it('should list jobs (empty initially) via GET /indexer/jobs', async () => {
    const res = await app.inject({ method: 'GET', url: '/indexer/jobs' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('should require workspacePath on scan via POST /indexer/scan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/indexer/scan',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('workspacePath');
  });

  it('should require query on search via GET /indexer/search', async () => {
    const res = await app.inject({ method: 'GET', url: '/indexer/search' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('query');
  });

  it('should stop returning false when no job running via POST /indexer/stop', async () => {
    const res = await app.inject({ method: 'POST', url: '/indexer/stop' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.stopped).toBe(false);
  });

  it('should return 404 for missing job via GET /indexer/jobs/:id', async () => {
    const res = await app.inject({ method: 'GET', url: '/indexer/jobs/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});
