/**
 * Integration tests — Plugin API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Plugin API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should list plugins (empty initially) via GET /plugins', async () => {
    const res = await app.inject({ method: 'GET', url: '/plugins' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('should install a plugin via POST /plugins/install', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/plugins/install',
      payload: {
        manifest: {
          id: 'test-plugin',
          name: 'Test Plugin',
          version: '1.0.0',
          description: 'A test plugin for integration tests',
          entry: 'index.ts',
          permissions: ['network', 'memory:read'],
        },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe('test-plugin');
    expect(body.name).toBe('Test Plugin');
    expect(body.enabled).toBe(false);
    expect(body.permissions).toEqual(['network', 'memory:read']);
  });

  it('should reject duplicate plugin install', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/plugins/install',
      payload: {
        manifest: {
          id: 'test-plugin',
          name: 'Test Plugin',
          version: '1.0.0',
          entry: 'index.ts',
        },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should validate manifest on install', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/plugins/install',
      payload: {
        manifest: {
          id: 'INVALID ID!',
          name: '',
          version: 'abc',
          entry: '',
        },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should get plugin details via GET /plugins/:id', async () => {
    const res = await app.inject({ method: 'GET', url: '/plugins/test-plugin' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe('test-plugin');
    expect(body.grantedPermissions).toBeDefined();
  });

  it('should return 404 for missing plugin', async () => {
    const res = await app.inject({ method: 'GET', url: '/plugins/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('should enable a plugin via POST /plugins/:id/enable', async () => {
    const res = await app.inject({ method: 'POST', url: '/plugins/test-plugin/enable' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.enabled).toBe(true);
  });

  it('should disable a plugin via POST /plugins/:id/disable', async () => {
    const res = await app.inject({ method: 'POST', url: '/plugins/test-plugin/disable' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.enabled).toBe(false);
  });

  it('should update plugin config via PATCH /plugins/:id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/plugins/test-plugin',
      payload: { pluginConfig: { apiKey: 'sk-test-123' } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.pluginConfig).toEqual({ apiKey: 'sk-test-123' });
  });

  it('should grant a permission via POST /plugins/:id/permissions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/plugins/test-plugin/permissions',
      payload: { permission: 'network' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.permissions.some((p: any) => p.permission === 'network' && p.granted)).toBe(true);
  });

  it('should revoke a permission via DELETE /plugins/:id/permissions/:permission', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/plugins/test-plugin/permissions/network',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.permissions.find((p: any) => p.permission === 'network')).toBeUndefined();
  });

  it('should list plugins after install', async () => {
    const res = await app.inject({ method: 'GET', url: '/plugins' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe('test-plugin');
  });

  it('should delete a plugin via DELETE /plugins/:id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/plugins/test-plugin' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.deleted).toBe(true);

    // Verify it's gone
    const listRes = await app.inject({ method: 'GET', url: '/plugins' });
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.total).toBe(0);
  });
});
