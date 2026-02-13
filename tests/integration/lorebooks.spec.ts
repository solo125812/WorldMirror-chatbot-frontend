/**
 * Integration tests — Lorebook API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Lorebook API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should create a lorebook via POST /lorebooks/edit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/lorebooks/edit',
      payload: {
        name: 'Test World',
        entries: [
          {
            keys: ['dragon'],
            content: 'Dragons are powerful creatures.',
            position: 'after_system',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Test World');
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].keys).toContain('dragon');
  });

  it('should list lorebooks via POST /lorebooks/list', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/lorebooks/list',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.lorebooks).toBeDefined();
    expect(body.lorebooks.length).toBeGreaterThanOrEqual(1);
  });

  it('should get a lorebook via POST /lorebooks/get', async () => {
    // First create one
    const createRes = await app.inject({
      method: 'POST',
      url: '/lorebooks/edit',
      payload: { name: 'Fetch Test Lorebook' },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'POST',
      url: '/lorebooks/get',
      payload: { id: created.id },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(created.id);
    expect(body.name).toBe('Fetch Test Lorebook');
  });

  it('should get a lorebook by name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/lorebooks/get',
      payload: { name: 'Fetch Test Lorebook' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Fetch Test Lorebook');
  });

  it('should return 404 for missing lorebook', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/lorebooks/get',
      payload: { id: 'nonexistent' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should import and export a lorebook', async () => {
    const importRes = await app.inject({
      method: 'POST',
      url: '/lorebooks/import',
      payload: {
        name: 'Imported World',
        entries: [
          { keys: ['elf'], content: 'Elves are graceful beings.', position: 'after_system' },
          { keys: ['dwarf'], content: 'Dwarves are sturdy.', position: 'before_history' },
        ],
      },
    });

    expect(importRes.statusCode).toBe(201);
    const imported = JSON.parse(importRes.body);
    expect(imported.entries).toHaveLength(2);

    // Export
    const exportRes = await app.inject({
      method: 'GET',
      url: `/lorebooks/${imported.id}/export`,
    });

    expect(exportRes.statusCode).toBe(200);
    const exported = JSON.parse(exportRes.body);
    expect(exported.name).toBe('Imported World');
    expect(exported.entries).toHaveLength(2);
  });

  it('should reject duplicate import', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/lorebooks/import',
      payload: { name: 'Imported World' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('should create and delete entries', async () => {
    // Create a lorebook first
    const lbRes = await app.inject({
      method: 'POST',
      url: '/lorebooks/edit',
      payload: { name: 'Entry Test Lorebook' },
    });
    const lb = JSON.parse(lbRes.body);

    // Create entry
    const entryRes = await app.inject({
      method: 'POST',
      url: '/lorebooks/entries',
      payload: {
        lorebookId: lb.id,
        keys: ['magic'],
        content: 'Magic flows through the world.',
        position: 'after_system',
      },
    });

    expect(entryRes.statusCode).toBe(201);
    const entry = JSON.parse(entryRes.body);
    expect(entry.keys).toContain('magic');

    // Update entry
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/lorebooks/entries/${entry.id}`,
      payload: { content: 'Updated magic content.' },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body);
    expect(updated.content).toBe('Updated magic content.');

    // Delete entry
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/lorebooks/entries/${entry.id}`,
    });

    expect(deleteRes.statusCode).toBe(200);
  });

  it('should create and delete bindings', async () => {
    // Get existing lorebook
    const lbRes = await app.inject({
      method: 'POST',
      url: '/lorebooks/get',
      payload: { name: 'Test World' },
    });
    const lb = JSON.parse(lbRes.body);

    // Create binding
    const bindRes = await app.inject({
      method: 'POST',
      url: '/lorebooks/bindings',
      payload: {
        lorebookId: lb.id,
        scope: 'global',
        priority: 1,
      },
    });

    expect(bindRes.statusCode).toBe(201);
    const binding = JSON.parse(bindRes.body);

    // List bindings
    const listRes = await app.inject({
      method: 'GET',
      url: '/lorebooks/bindings?scope=global',
    });

    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.bindings.length).toBeGreaterThanOrEqual(1);

    // Delete binding
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/lorebooks/bindings/${binding.id}`,
    });

    expect(deleteRes.statusCode).toBe(200);
  });

  it('should delete a lorebook', async () => {
    // Create a throwaway
    const createRes = await app.inject({
      method: 'POST',
      url: '/lorebooks/edit',
      payload: { name: 'Deleteable Lorebook' },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'POST',
      url: '/lorebooks/delete',
      payload: { id: created.id },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });
});
