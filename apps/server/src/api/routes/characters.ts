/**
 * Character API Routes
 */

import type { FastifyInstance } from 'fastify';
import { getContainer } from '../../di/container.js';
import { parseCharacterCard, extractCardFromPNG } from '@chatbot/core';

export async function characterRoutes(app: FastifyInstance): Promise<void> {
    /**
     * GET /characters — List characters with optional search/filter/pagination
     */
    app.get('/characters', async (request, reply) => {
        const { characterRepo } = getContainer();
        const query = request.query as { search?: string; tags?: string; limit?: string; offset?: string };

        const result = characterRepo.listCharacters({
            search: query.search,
            tags: query.tags ? query.tags.split(',') : undefined,
            limit: query.limit ? parseInt(query.limit, 10) : undefined,
            offset: query.offset ? parseInt(query.offset, 10) : undefined,
        });

        return result;
    });

    /**
     * GET /characters/:id — Get a single character
     */
    app.get('/characters/:id', async (request, reply) => {
        const { characterRepo } = getContainer();
        const { id } = request.params as { id: string };

        const character = characterRepo.getCharacter(id);
        if (!character) {
            return reply.status(404).send({ error: 'Character not found' });
        }

        return character;
    });

    /**
     * POST /characters — Create a new character
     */
    app.post('/characters', async (request, reply) => {
        const { characterRepo } = getContainer();
        const body = request.body as Record<string, unknown>;

        if (!body.name || typeof body.name !== 'string') {
            return reply.status(400).send({ error: 'Name is required' });
        }

        const character = characterRepo.createCharacter(body as any);
        return reply.status(201).send(character);
    });

    /**
     * PATCH /characters/:id — Update a character
     */
    app.patch('/characters/:id', async (request, reply) => {
        const { characterRepo } = getContainer();
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown>;

        const character = characterRepo.updateCharacter(id, body as any);
        if (!character) {
            return reply.status(404).send({ error: 'Character not found' });
        }

        return character;
    });

    /**
     * DELETE /characters/:id — Delete a character
     */
    app.delete('/characters/:id', async (request, reply) => {
        const { characterRepo } = getContainer();
        const { id } = request.params as { id: string };

        const deleted = characterRepo.deleteCharacter(id);
        if (!deleted) {
            return reply.status(404).send({ error: 'Character not found' });
        }

        return { success: true };
    });

    /**
     * POST /characters/import — Import a character card (JSON or PNG)
     */
    app.post('/characters/import', async (request, reply) => {
        const { characterRepo } = getContainer();
        const contentType = request.headers['content-type'] ?? '';

        let payload: any;

        if (contentType.includes('application/json')) {
            // JSON import
            payload = parseCharacterCard(request.body);
        } else if (contentType.includes('multipart/form-data')) {
            // File upload
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: 'No file uploaded' });
            }

            const buffer = await data.toBuffer();
            const filename = data.filename.toLowerCase();

            if (filename.endsWith('.png')) {
                payload = extractCardFromPNG(buffer);
            } else if (filename.endsWith('.json')) {
                const json = JSON.parse(buffer.toString('utf-8'));
                payload = parseCharacterCard(json);
            } else {
                return reply.status(400).send({ error: 'Unsupported file type. Use .json or .png' });
            }
        } else {
            // Try parsing body as JSON
            payload = parseCharacterCard(request.body);
        }

        const character = characterRepo.createCharacter(payload);
        return reply.status(201).send(character);
    });

    /**
     * GET /characters/:id/export — Export a character as V2 JSON
     */
    app.get('/characters/:id/export', async (request, reply) => {
        const { characterRepo } = getContainer();
        const { id } = request.params as { id: string };
        const { exportToJSON } = await import('@chatbot/core');

        const character = characterRepo.getCharacter(id);
        if (!character) {
            return reply.status(404).send({ error: 'Character not found' });
        }

        const json = exportToJSON(character);
        return reply
            .header('content-type', 'application/json')
            .header('content-disposition', `attachment; filename="${character.name.replace(/[^a-zA-Z0-9]/g, '_')}.json"`)
            .send(json);
    });
}
