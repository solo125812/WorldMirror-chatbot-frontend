/**
 * Branching API Routes
 * Phase 7 — Week 22
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';
import { makeId } from '@chatbot/utils';

export async function branchingRoutes(app: FastifyInstance) {
  // ─── Branches ────────────────────────────────────────────────

  app.post('/chats/:id/branches', async (request: FastifyRequest, reply: FastifyReply) => {
    const { chatRepo, messageRepo } = getContainer();
    const { id } = request.params as { id: string };
    const { messageId, label } = request.body as { messageId: string; label?: string };

    const sourceChat = chatRepo.get(id);
    if (!sourceChat) {
      return reply.status(404).send({ error: 'Chat not found' });
    }

    const allMessages = messageRepo.listByChatId(id);
    const branchIdx = allMessages.findIndex((m) => m.id === messageId);
    if (branchIdx === -1) {
      return reply.status(400).send({ error: 'Message not found in chat' });
    }

    const branchId = makeId();
    const db = (chatRepo as any).db;
    const rootRow = db.prepare('SELECT root_chat_id FROM chats WHERE id = ?').get(id) as any;
    const rootChatId = rootRow?.root_chat_id || id;
    const branchLabel = label || `Branch from message ${branchIdx + 1}`;

    chatRepo.create({
      id: branchId,
      title: `${sourceChat.title} — ${branchLabel}`,
      characterId: (sourceChat as any).character_id,
    });

    db.prepare(
      `UPDATE chats SET parent_chat_id = ?, branch_point_message_id = ?, root_chat_id = ?, branch_label = ? WHERE id = ?`,
    ).run(id, messageId, rootChatId, branchLabel, branchId);

    const messagesToCopy = allMessages.slice(0, branchIdx + 1);
    for (const msg of messagesToCopy) {
      messageRepo.create(branchId, msg.role, msg.content);
    }

    return reply.status(201).send({
      id: branchId,
      parentChatId: id,
      branchPointMessageId: messageId,
      rootChatId,
      label: branchLabel,
      messageCount: messagesToCopy.length,
    });
  });

  app.get('/chats/:id/branches', async (request: FastifyRequest, reply: FastifyReply) => {
    const { chatRepo } = getContainer();
    const { id } = request.params as { id: string };

    const db = (chatRepo as any).db;
    const rows = db
      .prepare(
        `SELECT id, parent_chat_id, branch_point_message_id, root_chat_id, branch_label, created_at
         FROM chats WHERE parent_chat_id = ? ORDER BY created_at ASC`,
      )
      .all(id) as any[];

    const branches = rows.map((row: any) => ({
      id: row.id,
      parentChatId: row.parent_chat_id,
      branchPointMessageId: row.branch_point_message_id,
      rootChatId: row.root_chat_id,
      label: row.branch_label || '',
      createdAt: row.created_at,
    }));

    return reply.send({ items: branches, total: branches.length });
  });

  // ─── Checkpoints ─────────────────────────────────────────────

  app.post('/chats/:id/checkpoints', async (request: FastifyRequest, reply: FastifyReply) => {
    const { chatRepo, checkpointRepo } = getContainer();
    const { id } = request.params as { id: string };
    const { messageId, label } = request.body as { messageId: string; label?: string };

    const chat = chatRepo.get(id);
    if (!chat) {
      return reply.status(404).send({ error: 'Chat not found' });
    }

    const checkpoint = checkpointRepo.create(id, messageId, label || 'Checkpoint');
    return reply.status(201).send(checkpoint);
  });

  app.get('/chats/:id/checkpoints', async (request: FastifyRequest, reply: FastifyReply) => {
    const { checkpointRepo } = getContainer();
    const { id } = request.params as { id: string };
    const checkpoints = checkpointRepo.listByChatId(id);
    return reply.send({ items: checkpoints, total: checkpoints.length });
  });

  app.post(
    '/chats/:id/checkpoints/:checkpointId/restore',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { chatRepo, messageRepo, checkpointRepo } = getContainer();
      const { id, checkpointId } = request.params as { id: string; checkpointId: string };

      const checkpoint = checkpointRepo.get(checkpointId);
      if (!checkpoint || checkpoint.chatId !== id) {
        return reply.status(404).send({ error: 'Checkpoint not found' });
      }

      const allMessages = messageRepo.listByChatId(id);
      const cpIdx = allMessages.findIndex((m) => m.id === checkpoint.messageId);
      if (cpIdx === -1) {
        return reply.status(400).send({ error: 'Checkpoint message not found' });
      }

      const branchId = makeId();
      const sourceChat = chatRepo.get(id)!;
      const db = (chatRepo as any).db;
      const rootRow = db.prepare('SELECT root_chat_id FROM chats WHERE id = ?').get(id) as any;
      const rootChatId = rootRow?.root_chat_id || id;
      const label = `Restored: ${checkpoint.label}`;

      chatRepo.create({
        id: branchId,
        title: `${sourceChat.title} — ${label}`,
        characterId: (sourceChat as any).character_id,
      });

      db.prepare(
        `UPDATE chats SET parent_chat_id = ?, branch_point_message_id = ?, root_chat_id = ?, branch_label = ? WHERE id = ?`,
      ).run(id, checkpoint.messageId, rootChatId, label, branchId);

      const messagesToCopy = allMessages.slice(0, cpIdx + 1);
      for (const msg of messagesToCopy) {
        messageRepo.create(branchId, msg.role, msg.content);
      }

      return reply.status(201).send({
        id: branchId,
        parentChatId: id,
        branchPointMessageId: checkpoint.messageId,
        rootChatId,
        label,
        messageCount: messagesToCopy.length,
      });
    },
  );
}
