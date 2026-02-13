/**
 * Integration tests — Triggers, Regex Rules, and Variables API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

describe('Triggers/Regex/Variables API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  // ─── Regex Rules ──────────────────────────────────────────────────

  describe('Regex Rules', () => {
    it('should create a regex rule via POST /regex-rules', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/regex-rules',
        payload: {
          pattern: '\\bfoo\\b',
          replacement: 'bar',
          placement: ['user_input'],
          scope: 'global',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.findRegex).toBe('\\bfoo\\b');
      expect(body.replaceString).toBe('bar');
    });

    it('should validate required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/regex-rules',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('should list regex rules via GET /regex-rules', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/regex-rules',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.rules).toBeDefined();
      expect(body.rules.length).toBeGreaterThanOrEqual(1);
    });

    it('should update a regex rule via PATCH /regex-rules/:id', async () => {
      // Create first
      const createRes = await app.inject({
        method: 'POST',
        url: '/regex-rules',
        payload: {
          pattern: 'old_pattern',
          replacement: 'old_replacement',
          placement: ['ai_output'],
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: `/regex-rules/${created.id}`,
        payload: { findRegex: 'new_pattern' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.findRegex).toBe('new_pattern');
    });

    it('should delete a regex rule via DELETE /regex-rules/:id', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/regex-rules',
        payload: {
          pattern: 'deleteme',
          replacement: '',
          placement: ['user_input'],
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'DELETE',
        url: `/regex-rules/${created.id}`,
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── Variables ────────────────────────────────────────────────────

  describe('Variables', () => {
    it('should set a variable via POST /variables', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/variables',
        payload: {
          key: 'test_var',
          value: 'hello',
          scope: 'global',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.key).toBe('test_var');
      expect(body.value).toBe('hello');
    });

    it('should get a variable via GET /variables/:key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/variables/test_var?scope=global',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.value).toBe('hello');
    });

    it('should list global variables', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/variables',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.variables).toBeDefined();
      expect(body.variables.length).toBeGreaterThanOrEqual(1);
    });

    it('should increment a numeric variable', async () => {
      // Set initial value
      await app.inject({
        method: 'POST',
        url: '/variables',
        payload: { key: 'counter', value: '10', scope: 'global' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/variables/counter/increment',
        payload: { delta: 5, scope: 'global' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.value).toBe('15');
    });

    it('should delete a variable', async () => {
      await app.inject({
        method: 'POST',
        url: '/variables',
        payload: { key: 'deleteme', value: 'temp', scope: 'global' },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/variables/deleteme?scope=global',
      });

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for missing variable', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/variables/nonexistent?scope=global',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── Triggers ─────────────────────────────────────────────────────

  describe('Triggers', () => {
    it('should create a trigger via POST /triggers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/triggers',
        payload: {
          name: 'Test Trigger',
          activation: 'before_generation',
          conditions: [
            { type: 'message_count', field: 'count', operator: '>', value: '5' },
          ],
          effects: [
            { type: 'set_variable', scope: 'global', key: 'triggered', value: 'true' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Test Trigger');
      expect(body.activation).toBe('before_generation');
      expect(body.conditions).toHaveLength(1);
      expect(body.effects).toHaveLength(1);
    });

    it('should validate required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/triggers',
        payload: { name: 'Missing Activation' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should list triggers via GET /triggers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/triggers',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.triggers).toBeDefined();
    });

    it('should list triggers by activation via GET /triggers?activation=...', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/triggers?activation=before_generation',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.triggers).toBeDefined();
      expect(body.triggers.length).toBeGreaterThanOrEqual(1);
    });

    it('should get a trigger by ID', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/triggers',
        payload: {
          name: 'Get Test Trigger',
          activation: 'after_generation',
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/triggers/${created.id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Get Test Trigger');
    });

    it('should update a trigger via PATCH /triggers/:id', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/triggers',
        payload: {
          name: 'Update Test Trigger',
          activation: 'before_generation',
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: `/triggers/${created.id}`,
        payload: { name: 'Updated Trigger Name', enabled: false },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Updated Trigger Name');
      expect(body.enabled).toBe(false);
    });

    it('should delete a trigger via DELETE /triggers/:id', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/triggers',
        payload: {
          name: 'Delete Test Trigger',
          activation: 'on_user_input',
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'DELETE',
        url: `/triggers/${created.id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });

    it('should return 404 for missing trigger', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/triggers/nonexistent',
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
