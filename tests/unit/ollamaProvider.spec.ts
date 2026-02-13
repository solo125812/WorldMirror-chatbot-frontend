/**
 * OllamaProvider tests — mock HTTP server inspired by SillyTavern's MockServer
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OllamaProvider } from '@chatbot/core';
import type { ChatMessage } from '@chatbot/types';
import { MockHttpServer } from '../helpers/mockHttpServer';

describe('OllamaProvider', () => {
  let server: MockHttpServer;
  let provider: OllamaProvider;

  beforeAll(async () => {
    server = new MockHttpServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/api/tags') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          models: [
            { name: 'llama3.2', details: { parameter_size: '70B' } },
          ],
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/chat') {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.write('{"message":{"content":"Hello"}}\n');
        res.write('{"message":{"content":" world"}}\n');
        res.write('{"done":true}\n');
        res.end();
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });

    await server.start();
    provider = new OllamaProvider({ baseUrl: server.url });
  });

  afterAll(async () => {
    await server.stop();
  });

  it('streams tokens and sends expected payload', async () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
    ];

    const tokens: string[] = [];
    let gotDone = false;

    for await (const chunk of provider.createChatCompletion(messages, {
      modelId: 'llama3.2',
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 42,
      stopSequences: ['END'],
      systemPrompt: 'SYS',
    })) {
      if (chunk.type === 'token' && chunk.value) tokens.push(chunk.value);
      if (chunk.type === 'done') gotDone = true;
    }

    expect(tokens.join('')).toBe('Hello world');
    expect(gotDone).toBe(true);

    const last = server.lastRequest;
    expect(last?.json?.model).toBe('llama3.2');
    expect(last?.json?.stream).toBe(true);
    expect(last?.json?.messages?.[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(last?.json?.messages?.[1]).toEqual({ role: 'user', content: 'Hello' });
    expect(last?.json?.options).toMatchObject({
      temperature: 0.2,
      top_p: 0.9,
      num_predict: 42,
      stop: ['END'],
    });
  });

  it('lists models and estimates context window', async () => {
    const models = await provider.listModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('llama3.2');
    expect(models[0].contextWindow).toBe(8192);
  });

  it('passes health check', async () => {
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeDefined();
  });
});
