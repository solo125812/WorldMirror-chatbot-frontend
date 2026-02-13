/**
 * Quick Reply API Routes
 * Phase 7 — Week 22
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function quickReplyRoutes(app: FastifyInstance) {
  // ─── Sets ────────────────────────────────────────────────────

  app.get('/quick-replies/sets', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplySetRepo } = getContainer();
    const { scope, characterId } = request.query as { scope?: string; characterId?: string };
    const sets = quickReplySetRepo.list({ scope, characterId });
    return reply.send({ items: sets, total: sets.length });
  });

  app.get('/quick-replies/sets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplySetRepo } = getContainer();
    const { id } = request.params as { id: string };
    const set = quickReplySetRepo.get(id);
    if (!set) {
      return reply.status(404).send({ error: 'Quick reply set not found' });
    }
    return reply.send(set);
  });

  app.post('/quick-replies/sets', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplySetRepo } = getContainer();
    const { name, scope, characterId } = request.body as {
      name: string;
      scope?: 'global' | 'character';
      characterId?: string;
    };

    if (!name) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const set = quickReplySetRepo.create(name, scope || 'global', characterId);
    return reply.status(201).send(set);
  });

  app.patch('/quick-replies/sets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplySetRepo } = getContainer();
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };

    const updated = quickReplySetRepo.update(id, { name });
    if (!updated) {
      return reply.status(404).send({ error: 'Quick reply set not found' });
    }
    return reply.send(quickReplySetRepo.get(id));
  });

  app.delete('/quick-replies/sets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplySetRepo } = getContainer();
    const { id } = request.params as { id: string };
    const deleted = quickReplySetRepo.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Quick reply set not found' });
    }
    return reply.status(204).send();
  });

  // ─── Items ───────────────────────────────────────────────────

  app.post('/quick-replies/items', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplyItemRepo } = getContainer();
    const { setId, label, command, sortOrder } = request.body as {
      setId: string;
      label: string;
      command: string;
      sortOrder?: number;
    };

    if (!setId || !label) {
      return reply.status(400).send({ error: 'setId and label are required' });
    }

    const item = quickReplyItemRepo.create(setId, label, command || '', sortOrder);
    return reply.status(201).send(item);
  });

  app.patch('/quick-replies/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplyItemRepo } = getContainer();
    const { id } = request.params as { id: string };
    const { label, command, sortOrder } = request.body as {
      label?: string;
      command?: string;
      sortOrder?: number;
    };

    const updated = quickReplyItemRepo.update(id, { label, command, sortOrder });
    if (!updated) {
      return reply.status(404).send({ error: 'Quick reply item not found' });
    }
    return reply.send({ success: true });
  });

  app.delete('/quick-replies/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplyItemRepo } = getContainer();
    const { id } = request.params as { id: string };
    const deleted = quickReplyItemRepo.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Quick reply item not found' });
    }
    return reply.status(204).send();
  });

  app.post('/quick-replies/items/reorder', async (request: FastifyRequest, reply: FastifyReply) => {
    const { quickReplyItemRepo } = getContainer();
    const { setId, itemIds } = request.body as { setId: string; itemIds: string[] };

    if (!setId || !Array.isArray(itemIds)) {
      return reply.status(400).send({ error: 'setId and itemIds array are required' });
    }

    quickReplyItemRepo.reorder(setId, itemIds);
    return reply.send({ success: true });
  });
}
