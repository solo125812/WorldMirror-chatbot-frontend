/**
 * Group Chat API Routes — CRUD for group chats and chat bindings
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function groupRoutes(app: FastifyInstance) {
  // ─── Group Chats ────────────────────────────────────────────────────

  /** GET /groups — list group chats */
  app.get('/groups', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { groupChatRepo } = getContainer();
    const result = groupChatRepo.list();
    return reply.send(result);
  });

  /** POST /groups — create group chat */
  app.post('/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupChatRepo } = getContainer();
    const body = request.body as any;

    if (!body?.name) {
      return reply.status(400).send({ error: 'name required' });
    }

    const group = groupChatRepo.create(body);
    return reply.status(201).send(group);
  });

  /** GET /groups/:id — get group chat */
  app.get('/groups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupChatRepo } = getContainer();
    const { id } = request.params as { id: string };

    const group = groupChatRepo.get(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    return reply.send(group);
  });

  /** PATCH /groups/:id — update group chat */
  app.patch('/groups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupChatRepo } = getContainer();
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const group = groupChatRepo.update(id, body);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    return reply.send(group);
  });

  /** DELETE /groups/:id — delete group chat */
  app.delete('/groups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupChatRepo } = getContainer();
    const { id } = request.params as { id: string };

    const deleted = groupChatRepo.delete(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    return reply.send({ success: true });
  });

  // ─── Chat-Group Bindings ────────────────────────────────────────────

  /** POST /groups/:id/bind — bind a chat to a group */
  app.post('/groups/:id/bind', async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupChatRepo } = getContainer();
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (!body?.chatId) {
      return reply.status(400).send({ error: 'chatId required' });
    }

    const group = groupChatRepo.get(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    groupChatRepo.bindChat(body.chatId, id);
    return reply.status(201).send({ success: true, groupId: id, chatId: body.chatId });
  });

  /** DELETE /groups/:id/bind/:chatId — unbind a chat from a group */
  app.delete('/groups/:id/bind/:chatId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupChatRepo } = getContainer();
    const { chatId } = request.params as { id: string; chatId: string };

    const deleted = groupChatRepo.unbindChat(chatId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Binding not found' });
    }

    return reply.send({ success: true });
  });

  /** GET /groups/for-chat/:chatId — get group for a chat */
  app.get('/groups/for-chat/:chatId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupChatRepo } = getContainer();
    const { chatId } = request.params as { chatId: string };

    const group = groupChatRepo.getGroupForChat(chatId);
    if (!group) {
      return reply.status(404).send({ error: 'No group for this chat' });
    }

    return reply.send(group);
  });
}
