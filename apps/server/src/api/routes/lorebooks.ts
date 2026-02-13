/**
 * Lorebook API Routes — CRUD for lorebooks, entries, and bindings
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function lorebookRoutes(app: FastifyInstance) {
  // ─── Lorebooks ───────────────────────────────────────────────────────

  /** POST /lorebooks/list — list lorebooks */
  app.post('/lorebooks/list', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookRepo } = getContainer();
    const body = (request.body as any) ?? {};
    const { search, limit, offset } = body;
    const result = lorebookRepo.list({ search, limit, offset });
    return reply.send(result);
  });

  /** POST /lorebooks/get — get lorebook by id or name */
  app.post('/lorebooks/get', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookRepo, lorebookEntryRepo } = getContainer();
    const body = request.body as any;

    if (!body?.id && !body?.name) {
      return reply.status(400).send({ error: 'id or name required' });
    }

    const lorebook = body.id
      ? lorebookRepo.get(body.id)
      : lorebookRepo.getByName(body.name);

    if (!lorebook) {
      return reply.status(404).send({ error: 'Lorebook not found' });
    }

    const entries = lorebookEntryRepo.listByLorebook(lorebook.id);
    return reply.send({ ...lorebook, entries });
  });

  /** POST /lorebooks/edit — create or update lorebook + entries */
  app.post('/lorebooks/edit', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookRepo, lorebookEntryRepo } = getContainer();
    const body = request.body as any;

    if (!body?.name && !body?.id) {
      return reply.status(400).send({ error: 'name or id required' });
    }

    let lorebook;

    if (body.id) {
      // Update existing
      lorebook = lorebookRepo.update(body.id, body);
      if (!lorebook) {
        return reply.status(404).send({ error: 'Lorebook not found' });
      }
    } else {
      // Create new or update by name
      const existing = lorebookRepo.getByName(body.name);
      if (existing) {
        lorebook = lorebookRepo.update(existing.id, body);
      } else {
        lorebook = lorebookRepo.create(body);
      }
    }

    // Handle entries if provided
    if (body.entries && Array.isArray(body.entries)) {
      for (const entryData of body.entries) {
        if (entryData.id) {
          // Update existing entry
          lorebookEntryRepo.update(entryData.id, entryData);
        } else {
          // Create new entry
          lorebookEntryRepo.create({ ...entryData, lorebookId: lorebook!.id });
        }
      }
    }

    const entries = lorebookEntryRepo.listByLorebook(lorebook!.id);
    return reply.status(200).send({ ...lorebook, entries });
  });

  /** POST /lorebooks/delete — delete lorebook */
  app.post('/lorebooks/delete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookRepo } = getContainer();
    const body = request.body as any;

    if (!body?.id) {
      return reply.status(400).send({ error: 'id required' });
    }

    const deleted = lorebookRepo.delete(body.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Lorebook not found' });
    }

    return reply.send({ success: true });
  });

  /** POST /lorebooks/import — import lorebook from JSON */
  app.post('/lorebooks/import', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookRepo, lorebookEntryRepo } = getContainer();
    const body = request.body as any;

    if (!body?.name) {
      return reply.status(400).send({ error: 'Lorebook data with name required' });
    }

    // Check for duplicate name
    const existing = lorebookRepo.getByName(body.name);
    if (existing) {
      return reply.status(409).send({ error: `Lorebook "${body.name}" already exists` });
    }

    const lorebook = lorebookRepo.create(body);

    // Import entries if provided
    if (body.entries && Array.isArray(body.entries)) {
      for (const entryData of body.entries) {
        lorebookEntryRepo.create({ ...entryData, lorebookId: lorebook.id });
      }
    }

    const entries = lorebookEntryRepo.listByLorebook(lorebook.id);
    return reply.status(201).send({ ...lorebook, entries });
  });

  /** GET /lorebooks/:id/export — export lorebook as JSON */
  app.get('/lorebooks/:id/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookRepo, lorebookEntryRepo } = getContainer();
    const { id } = request.params as { id: string };

    const lorebook = lorebookRepo.get(id);
    if (!lorebook) {
      return reply.status(404).send({ error: 'Lorebook not found' });
    }

    const entries = lorebookEntryRepo.listByLorebook(lorebook.id);

    reply.header('content-type', 'application/json');
    return reply.send({ ...lorebook, entries });
  });

  // ─── Entries (direct CRUD) ──────────────────────────────────────────

  /** POST /lorebooks/entries — create entry */
  app.post('/lorebooks/entries', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookEntryRepo } = getContainer();
    const body = request.body as any;

    if (!body?.lorebookId) {
      return reply.status(400).send({ error: 'lorebookId required' });
    }

    const entry = lorebookEntryRepo.create(body);
    return reply.status(201).send(entry);
  });

  /** PATCH /lorebooks/entries/:id — update entry */
  app.patch('/lorebooks/entries/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookEntryRepo } = getContainer();
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const entry = lorebookEntryRepo.update(id, body);
    if (!entry) {
      return reply.status(404).send({ error: 'Entry not found' });
    }

    return reply.send(entry);
  });

  /** DELETE /lorebooks/entries/:id — delete entry */
  app.delete('/lorebooks/entries/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookEntryRepo } = getContainer();
    const { id } = request.params as { id: string };

    const deleted = lorebookEntryRepo.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Entry not found' });
    }

    return reply.send({ success: true });
  });

  // ─── Bindings ───────────────────────────────────────────────────────

  /** POST /lorebooks/bindings — create binding */
  app.post('/lorebooks/bindings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookBindingRepo } = getContainer();
    const body = request.body as any;

    if (!body?.lorebookId || !body?.scope) {
      return reply.status(400).send({ error: 'lorebookId and scope required' });
    }

    const binding = lorebookBindingRepo.create(body);
    return reply.status(201).send(binding);
  });

  /** DELETE /lorebooks/bindings/:id — delete binding */
  app.delete('/lorebooks/bindings/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookBindingRepo } = getContainer();
    const { id } = request.params as { id: string };

    const deleted = lorebookBindingRepo.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Binding not found' });
    }

    return reply.send({ success: true });
  });

  /** GET /lorebooks/bindings — list bindings by scope */
  app.get('/lorebooks/bindings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lorebookBindingRepo } = getContainer();
    const query = request.query as any;
    const scope = query.scope ?? 'global';
    const sourceId = query.sourceId ?? null;

    const bindings = lorebookBindingRepo.listByScope(scope, sourceId);
    return reply.send({ bindings });
  });
}
