/**
 * Integration tests — Group Chat API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Group Chat API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should create a group chat via POST /groups', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/groups',
      payload: {
        name: 'Test Group',
        characterIds: ['char-a', 'char-b'],
        activationStrategy: 'sequential',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Test Group');
    expect(body.characterIds).toContain('char-a');
    expect(body.characterIds).toContain('char-b');
  });

  it('should validate required name on create', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/groups',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('should list groups via GET /groups', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/groups',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.groups).toBeDefined();
    expect(body.groups.length).toBeGreaterThanOrEqual(1);
  });

  it('should get a group by ID', async () => {
    // Create first
    const createRes = await app.inject({
      method: 'POST',
      url: '/groups',
      payload: {
        name: 'Get Test Group',
        characterIds: ['char-x'],
        activationStrategy: 'random',
      },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'GET',
      url: `/groups/${created.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Get Test Group');
  });

  it('should return 404 for missing group', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/groups/nonexistent',
    });

    expect(res.statusCode).toBe(404);
  });

  it('should update a group via PATCH /groups/:id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/groups',
      payload: {
        name: 'Update Test Group',
        characterIds: ['char-a'],
      },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'PATCH',
      url: `/groups/${created.id}`,
      payload: {
        name: 'Updated Group Name',
        activationStrategy: 'smart',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Updated Group Name');
    expect(body.activationStrategy).toBe('smart');
  });

  it('should delete a group via DELETE /groups/:id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/groups',
      payload: {
        name: 'Deleteable Group',
        characterIds: ['char-a'],
      },
    });
    const created = JSON.parse(createRes.body);

    const res = await app.inject({
      method: 'DELETE',
      url: `/groups/${created.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it('should bind and unbind a chat to a group', async () => {
    const groupRes = await app.inject({
      method: 'POST',
      url: '/groups',
      payload: {
        name: 'Binding Group',
        characterIds: ['char-a'],
      },
    });
    const group = JSON.parse(groupRes.body);

    const chatRes = await app.inject({
      method: 'POST',
      url: '/chat',
      payload: { message: 'Hello group binding' },
    });
    const chatBody = JSON.parse(chatRes.body);
    const chatId = chatBody.chatId;

    const bindRes = await app.inject({
      method: 'POST',
      url: `/groups/${group.id}/bind`,
      payload: { chatId },
    });
    expect(bindRes.statusCode).toBe(201);

    const forChatRes = await app.inject({
      method: 'GET',
      url: `/groups/for-chat/${chatId}`,
    });
    expect(forChatRes.statusCode).toBe(200);
    const forChatBody = JSON.parse(forChatRes.body);
    expect(forChatBody.id).toBe(group.id);

    const unbindRes = await app.inject({
      method: 'DELETE',
      url: `/groups/${group.id}/bind/${chatId}`,
    });
    expect(unbindRes.statusCode).toBe(200);

    const missingRes = await app.inject({
      method: 'GET',
      url: `/groups/for-chat/${chatId}`,
    });
    expect(missingRes.statusCode).toBe(404);
  });
});
