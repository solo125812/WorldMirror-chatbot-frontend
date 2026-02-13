/**
 * Instruct Mode and Tokenization API Routes
 * Phase 7 — Week 20
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';
import { formatChatToInstruct } from '@chatbot/core';

export async function instructRoutes(app: FastifyInstance) {
  // ─── Instruct Templates ─────────────────────────────────────

  app.get('/instruct/presets', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { promptFormatRegistry } = getContainer();
    const presets = promptFormatRegistry.listPresets();
    return reply.send({ items: presets, total: presets.length });
  });

  app.get('/instruct/presets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { promptFormatRegistry } = getContainer();
    const { id } = request.params as { id: string };
    const preset = promptFormatRegistry.getPreset(id);
    if (!preset) {
      return reply.status(404).send({ error: 'Instruct preset not found' });
    }
    return reply.send(preset);
  });

  app.get('/instruct/detect', async (request: FastifyRequest, reply: FastifyReply) => {
    const { promptFormatRegistry } = getContainer();
    const { modelId } = request.query as { modelId?: string };
    if (!modelId) {
      return reply.status(400).send({ error: 'modelId query parameter is required' });
    }
    const preset = promptFormatRegistry.detectPreset(modelId);
    return reply.send({ preset: preset || null, detected: !!preset });
  });

  app.post('/instruct/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const { promptFormatRegistry } = getContainer();
    const { messages, presetId, systemPrompt } = request.body as {
      messages: Array<{ role: string; content: string }>;
      presetId: string;
      systemPrompt?: string;
    };

    if (!messages || !presetId) {
      return reply.status(400).send({ error: 'messages and presetId are required' });
    }

    const preset = promptFormatRegistry.getPreset(presetId);
    if (!preset) {
      return reply.status(404).send({ error: 'Instruct preset not found' });
    }

    const formatted = formatChatToInstruct(messages, preset.template, {
      appendGenerationPrompt: true,
      systemPrompt,
    });

    return reply.send({ formatted, presetName: preset.name });
  });

  // ─── Tokenization ───────────────────────────────────────────

  app.post('/tokenize', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tokenizerRegistry } = getContainer();
    const { text, modelId } = request.body as { text: string; modelId?: string };

    if (text === undefined || text === null) {
      return reply.status(400).send({ error: 'text is required' });
    }

    const result = tokenizerRegistry.countTokens(text, modelId);
    return reply.send({
      count: result.count,
      tokenizerName: result.tokenizerName,
      isApproximate: result.isApproximate,
    });
  });

  app.get('/tokenizers', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { tokenizerRegistry } = getContainer();
    const tokenizers = tokenizerRegistry.listTokenizers();
    const initialized = tokenizerRegistry.getInitializedTokenizers();
    return reply.send({
      items: tokenizers.map((t) => ({
        ...t,
        initialized: initialized.includes(t.id) || t.type === 'heuristic',
      })),
      total: tokenizers.length,
    });
  });
}
