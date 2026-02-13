/**
 * Triggers, Regex Rules, and Variables API Routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function triggerRoutes(app: FastifyInstance) {
  // ─── Regex Rules ────────────────────────────────────────────────────

  /** GET /regex-rules — list regex rules (optionally filtered by characterId) */
  app.get('/regex-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const { regexRuleRepo } = getContainer();
    const query = request.query as any;
    const characterId = query.characterId ?? null;

    const rules = regexRuleRepo.listForContext(characterId);
    return reply.send({ rules });
  });

  /** POST /regex-rules — create regex rule */
  app.post('/regex-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const { regexRuleRepo } = getContainer();
    const body = request.body as any;

    // Accept both findRegex/replaceString and pattern/replacement for convenience
    const findRegex = body?.findRegex ?? body?.pattern;
    const replaceString = body?.replaceString ?? body?.replacement ?? '';

    if (!findRegex) {
      return reply.status(400).send({ error: 'findRegex (or pattern) required' });
    }

    const name = body?.name ?? findRegex;
    // Normalize placement to array
    const placement = body?.placement
      ? (Array.isArray(body.placement) ? body.placement : [body.placement])
      : undefined;

    const rule = regexRuleRepo.create({
      ...body,
      name,
      findRegex,
      replaceString,
      placement,
    });
    return reply.status(201).send(rule);
  });

  /** PATCH /regex-rules/:id — update regex rule */
  app.patch('/regex-rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { regexRuleRepo } = getContainer();
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const rule = regexRuleRepo.update(id, body);
    if (!rule) {
      return reply.status(404).send({ error: 'Regex rule not found' });
    }

    return reply.send(rule);
  });

  /** DELETE /regex-rules/:id — delete regex rule */
  app.delete('/regex-rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { regexRuleRepo } = getContainer();
    const { id } = request.params as { id: string };

    const deleted = regexRuleRepo.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Regex rule not found' });
    }

    return reply.send({ success: true });
  });

  // ─── Variables ──────────────────────────────────────────────────────

  /** GET /variables — list variables (global or for a chat) */
  app.get('/variables', async (request: FastifyRequest, reply: FastifyReply) => {
    const { variableRepo } = getContainer();
    const query = request.query as any;
    const chatId = query.chatId ?? null;

    const variables = chatId
      ? variableRepo.listChat(chatId)
      : variableRepo.listGlobal();
    return reply.send({ variables });
  });

  /** POST /variables — set a variable (upsert) */
  app.post('/variables', async (request: FastifyRequest, reply: FastifyReply) => {
    const { variableRepo } = getContainer();
    const body = request.body as any;

    if (!body?.key) {
      return reply.status(400).send({ error: 'key required' });
    }

    const scope = body.scope ?? 'global';
    const chatId = body.chatId ?? null;

    variableRepo.set(scope as 'global' | 'chat', body.key, body.value ?? '', chatId);
    const variable = variableRepo.get(scope as 'global' | 'chat', body.key, chatId);
    return reply.send(variable);
  });

  /** GET /variables/:key — get a variable value */
  app.get('/variables/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { variableRepo } = getContainer();
    const { key } = request.params as { key: string };
    const query = request.query as any;
    const scope = (query.scope ?? 'global') as 'global' | 'chat';
    const chatId = query.chatId ?? null;

    const variable = variableRepo.get(scope, key, chatId);
    if (!variable) {
      return reply.status(404).send({ error: 'Variable not found' });
    }

    return reply.send(variable);
  });

  /** DELETE /variables/:key — delete a variable */
  app.delete('/variables/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    const { variableRepo } = getContainer();
    const { key } = request.params as { key: string };
    const query = request.query as any;
    const scope = (query.scope ?? 'global') as 'global' | 'chat';
    const chatId = query.chatId ?? null;

    const deleted = variableRepo.delete(scope, key, chatId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Variable not found' });
    }

    return reply.send({ success: true });
  });

  /** POST /variables/:key/increment — increment a numeric variable */
  app.post('/variables/:key/increment', async (request: FastifyRequest, reply: FastifyReply) => {
    const { variableRepo } = getContainer();
    const { key } = request.params as { key: string };
    const body = request.body as any;
    const scope = (body?.scope ?? 'global') as 'global' | 'chat';
    const chatId = body?.chatId ?? null;
    const delta = body?.delta ?? 1;

    const result = variableRepo.increment(scope, key, delta, chatId);
    return reply.send({ key, value: result.value, scope, chatId });
  });

  // ─── Triggers ───────────────────────────────────────────────────────

  /** GET /triggers — list triggers (optionally by activation point) */
  app.get('/triggers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { triggerRepo } = getContainer();
    const query = request.query as any;
    const activation = query.activation ?? null;
    const characterId = query.characterId ?? null;

    if (activation) {
      const triggers = triggerRepo.listForActivation(activation as any, characterId);
      return reply.send({ triggers });
    }

    const triggers = triggerRepo.list();
    return reply.send(triggers);
  });

  /** POST /triggers — create trigger */
  app.post('/triggers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { triggerRepo } = getContainer();
    const body = request.body as any;

    if (!body?.name || !body?.activation) {
      return reply.status(400).send({ error: 'name and activation required' });
    }

    const trigger = triggerRepo.create(body);
    return reply.status(201).send(trigger);
  });

  /** GET /triggers/:id — get trigger */
  app.get('/triggers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { triggerRepo } = getContainer();
    const { id } = request.params as { id: string };

    const trigger = triggerRepo.get(id);
    if (!trigger) {
      return reply.status(404).send({ error: 'Trigger not found' });
    }

    return reply.send(trigger);
  });

  /** PATCH /triggers/:id — update trigger */
  app.patch('/triggers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { triggerRepo } = getContainer();
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const trigger = triggerRepo.update(id, body);
    if (!trigger) {
      return reply.status(404).send({ error: 'Trigger not found' });
    }

    return reply.send(trigger);
  });

  /** DELETE /triggers/:id — delete trigger */
  app.delete('/triggers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { triggerRepo } = getContainer();
    const { id } = request.params as { id: string };

    const deleted = triggerRepo.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Trigger not found' });
    }

    return reply.send({ success: true });
  });
}
