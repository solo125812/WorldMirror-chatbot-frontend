/**
 * Integration tests — Memory API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';

function buildMultipartTextUpload(opts: { filename: string; content: string; title?: string }) {
  const boundary = `----wm-boundary-${Math.random().toString(16).slice(2)}`;
  const lines: string[] = [];

  if (opts.title) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Disposition: form-data; name="title"`);
    lines.push('');
    lines.push(opts.title);
  }

  lines.push(`--${boundary}`);
  lines.push(
    `Content-Disposition: form-data; name="file"; filename="${opts.filename}"`
  );
  lines.push('Content-Type: text/plain');
  lines.push('');
  lines.push(opts.content);
  lines.push(`--${boundary}--`);
  lines.push('');

  const body = lines.join('\r\n');
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('Memory API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  describe('POST /memory/capture', () => {
    it('should create a manual memory entry', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/memory/capture',
        payload: {
          content: 'The user prefers TypeScript.',
          category: 'preference',
          scope: 'global',
          importance: 0.7,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeTruthy();
      expect(body.content).toBe('The user prefers TypeScript.');
      expect(body.category).toBe('preference');
      expect(body.scope).toBe('global');
      expect(body.importance).toBe(0.7);
      expect(body.autoCaptured).toBe(false);
    });

    it('should return 400 for missing content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/memory/capture',
        payload: {
          category: 'fact',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should default to fact category and global scope', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/memory/capture',
        payload: {
          content: 'Some important fact.',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.category).toBe('fact');
      expect(body.scope).toBe('global');
    });
  });

  describe('GET /memory/entries', () => {
    it('should list memory entries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/memory/entries',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toBeDefined();
      expect(Array.isArray(body.entries)).toBe(true);
      expect(body.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter by scope', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/memory/entries?scope=global',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      for (const entry of body.entries) {
        expect(entry.scope).toBe('global');
      }
    });
  });

  describe('GET /memory/search', () => {
    it('should search memory entries', async () => {
      // First create an entry to search for
      await app.inject({
        method: 'POST',
        url: '/memory/capture',
        payload: {
          content: 'The database uses PostgreSQL version 15.',
          category: 'fact',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/memory/search?q=PostgreSQL',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results).toBeDefined();
      expect(Array.isArray(body.results)).toBe(true);
    });

    it('should return 400 for missing query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/memory/search',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return document hits for ingested content', async () => {
      const ingestRes = await app.inject({
        method: 'POST',
        url: '/memory/ingest',
        payload: {
          type: 'text',
          content: 'WorldMirror memory search should find uniqueToken123 content.',
          title: 'Searchable Doc',
        },
      });

      expect(ingestRes.statusCode).toBe(201);

      const response = await app.inject({
        method: 'GET',
        url: '/memory/search?q=uniqueToken123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const docs = (body.results ?? []).filter((r: any) => r.entry?.category === 'document');
      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].entry.content).toContain('uniqueToken123');
    });
  });

  describe('POST /memory/ingest', () => {
    it('should ingest text content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/memory/ingest',
        payload: {
          type: 'text',
          content: 'This is a test document with some content that should be chunked and stored for retrieval.',
          title: 'Test Document',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.document).toBeDefined();
      expect(body.document.title).toBe('Test Document');
      expect(body.chunks).toBeGreaterThan(0);
    });

    it('should return 400 for missing type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/memory/ingest',
        payload: {
          content: 'Some content',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for text type without content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/memory/ingest',
        payload: {
          type: 'text',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should ingest multipart text files', async () => {
      const { body, contentType } = buildMultipartTextUpload({
        filename: 'upload.txt',
        content: 'Multipart ingestion content for WorldMirror.',
        title: 'Multipart Doc',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/memory/ingest',
        payload: body,
        headers: {
          'content-type': contentType,
        },
      });

      expect(response.statusCode).toBe(201);
      const parsed = JSON.parse(response.body);
      expect(parsed.document.title).toBe('Multipart Doc');
      expect(parsed.chunks).toBeGreaterThan(0);
    });
  });

  describe('GET /memory/documents', () => {
    it('should list ingested documents', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/memory/documents',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.documents).toBeDefined();
      expect(Array.isArray(body.documents)).toBe(true);
    });
  });

  describe('DELETE /memory/documents/:id', () => {
    it('should delete an ingested document', async () => {
      const ingestRes = await app.inject({
        method: 'POST',
        url: '/memory/ingest',
        payload: {
          type: 'text',
          content: 'Document to delete with token deleteDocXYZ.',
          title: 'Delete Doc',
        },
      });

      expect(ingestRes.statusCode).toBe(201);
      const ingestBody = JSON.parse(ingestRes.body);
      const docId = ingestBody.document.id;

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/memory/documents/${docId}`,
      });

      expect(deleteRes.statusCode).toBe(200);

      const listRes = await app.inject({
        method: 'GET',
        url: '/memory/documents',
      });
      const listBody = JSON.parse(listRes.body);
      const exists = (listBody.documents ?? []).some((d: any) => d.id === docId);
      expect(exists).toBe(false);
    });
  });

  describe('DELETE /memory/:id', () => {
    it('should delete a memory entry', async () => {
      // Create an entry first
      const createRes = await app.inject({
        method: 'POST',
        url: '/memory/capture',
        payload: {
          content: 'Temporary entry to delete.',
        },
      });
      const entry = JSON.parse(createRes.body);

      // Delete it
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/memory/${entry.id}`,
      });

      expect(deleteRes.statusCode).toBe(204);
    });

    it('should return 404 for non-existent entry', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/memory/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should remove deleted entry from memory search results', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/memory/capture',
        payload: {
          content: 'Searchable delete me token xyzDelete123.',
        },
      });
      const entry = JSON.parse(createRes.body);

      const searchBefore = await app.inject({
        method: 'GET',
        url: '/memory/search?q=xyzDelete123',
      });
      const beforeBody = JSON.parse(searchBefore.body);
      expect((beforeBody.results ?? []).length).toBeGreaterThan(0);

      await app.inject({
        method: 'DELETE',
        url: `/memory/${entry.id}`,
      });

      const searchAfter = await app.inject({
        method: 'GET',
        url: '/memory/search?q=xyzDelete123',
      });
      const afterBody = JSON.parse(searchAfter.body);
      const stillPresent = (afterBody.results ?? []).some(
        (r: any) => r.entry?.id === entry.id
      );
      expect(stillPresent).toBe(false);
    });
  });
});
