/**
 * Chat History API Routes — paginated list and message retrieval
 */

import type { FastifyInstance } from 'fastify';
import { getContainer } from '../di/container.js';

export async function chatHistoryRoutes(app: FastifyInstance): Promise<void> {
    /**
     * GET /chats — Paginated chat list
     */
    app.get('/chats', async (request) => {
        const { chatService } = getContainer();
        const query = request.query as { limit?: string; offset?: string; characterId?: string };

        return chatService.listChats({
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
            offset: query.offset ? parseInt(query.offset, 10) : undefined,
            characterId: query.characterId,
        });
    });

    /**
     * GET /chats/:id — Get a single chat with messages
     */
    app.get('/chats/:id', async (request, reply) => {
        const { chatService } = getContainer();
        const { id } = request.params as { id: string };

        const chat = chatService.getChat(id);
        if (!chat) {
            return reply.status(404).send({ error: 'Chat not found' });
        }

        return chat;
    });

    /**
     * GET /chats/:id/messages — Cursor-paginated messages
     */
    app.get('/chats/:id/messages', async (request, reply) => {
        const { messageRepo } = getContainer();
        const { id } = request.params as { id: string };
        const query = request.query as { limit?: string; before?: string };

        const result = messageRepo.listMessages(id, {
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
            before: query.before,
        });

        return result;
    });

    /**
     * DELETE /chats/:id — Delete a chat
     */
    app.delete('/chats/:id', async (request, reply) => {
        const { chatRepo } = getContainer();
        const { id } = request.params as { id: string };

        const deleted = chatRepo.deleteChat(id);
        if (!deleted) {
            return reply.status(404).send({ error: 'Chat not found' });
        }

        return { success: true };
    });
}
