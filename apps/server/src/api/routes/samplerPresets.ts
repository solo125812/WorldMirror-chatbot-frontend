/**
 * Sampler Presets API Routes
 */

import type { FastifyInstance } from 'fastify';
import { getContainer } from '../di/container.js';

export async function samplerPresetRoutes(app: FastifyInstance): Promise<void> {
    /**
     * GET /sampler-presets — List all presets
     */
    app.get('/sampler-presets', async () => {
        const { samplerPresetRepo } = getContainer();
        return { presets: samplerPresetRepo.list() };
    });

    /**
     * POST /sampler-presets — Create a new preset
     */
    app.post('/sampler-presets', async (request, reply) => {
        const { samplerPresetRepo } = getContainer();
        const body = request.body as { name?: string; description?: string; settings?: Record<string, unknown> };

        if (!body.name) {
            return reply.status(400).send({ error: 'Name is required' });
        }
        if (!body.settings || typeof body.settings !== 'object') {
            return reply.status(400).send({ error: 'Settings object is required' });
        }

        const preset = samplerPresetRepo.create({
            name: body.name,
            description: body.description,
            settings: body.settings as any,
        });

        return reply.status(201).send(preset);
    });

    /**
     * PATCH /sampler-presets/:id — Update a preset
     */
    app.patch('/sampler-presets/:id', async (request, reply) => {
        const { samplerPresetRepo } = getContainer();
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown>;

        try {
            const preset = samplerPresetRepo.update(id, body as any);
            if (!preset) {
                return reply.status(404).send({ error: 'Preset not found' });
            }
            return preset;
        } catch (error) {
            return reply.status(400).send({ error: error instanceof Error ? error.message : 'Update failed' });
        }
    });

    /**
     * DELETE /sampler-presets/:id — Delete a preset
     */
    app.delete('/sampler-presets/:id', async (request, reply) => {
        const { samplerPresetRepo } = getContainer();
        const { id } = request.params as { id: string };

        try {
            const deleted = samplerPresetRepo.delete(id);
            if (!deleted) {
                return reply.status(404).send({ error: 'Preset not found' });
            }
            return { success: true };
        } catch (error) {
            return reply.status(400).send({ error: error instanceof Error ? error.message : 'Delete failed' });
        }
    });
}
