/**
 * AnthropicProvider tests — mock HTTP server inspired by SillyTavern's MockServer
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AnthropicProvider } from '@chatbot/core';
import type { ChatMessage } from '@chatbot/types';
import { MockHttpServer } from '../helpers/mockHttpServer';

describe('AnthropicProvider', () => {
  let server: MockHttpServer;
  let provider: AnthropicProvider;

  beforeAll(async () => {
    server = new MockHttpServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/v1/messages') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        res.write('data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n');
        res.write('\n');
        res.write('data: {"type":"content_block_delta","delta":{"text":" world"}}\n');
        res.write('\n');
        res.write('data: {"type":"message_stop"}\n');
        res.write('\n');
        res.end();
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });

    await server.start();
    provider = new AnthropicProvider({ apiKey: 'test-key', baseUrl: server.url });
  });

  afterAll(async () => {
    await server.stop();
  });

  it('streams tokens and formats request body', async () => {
    const messages: ChatMessage[] = [
      { id: 'sys', role: 'system', content: 'SYS', createdAt: new Date().toISOString() },
      { id: 'user', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
    ];

    const tokens: string[] = [];
    let gotDone = false;

    for await (const chunk of provider.createChatCompletion(messages, {
      modelId: 'claude-test',
      temperature: 0.7,
      maxTokens: 123,
      topP: 0.9,
    })) {
      if (chunk.type === 'token' && chunk.value) tokens.push(chunk.value);
      if (chunk.type === 'done') gotDone = true;
    }

    expect(tokens.join('')).toBe('Hello world');
    expect(gotDone).toBe(true);

    const last = server.lastRequest;
    expect(last?.json?.model).toBe('claude-test');
    expect(last?.json?.system).toBe('SYS');
    expect(last?.json?.messages).toEqual([
      { role: 'user', content: 'Hello' },
    ]);
    expect(last?.json?.max_tokens).toBe(123);
    expect(last?.json?.temperature).toBe(0.7);
    expect(last?.json?.top_p).toBe(0.9);
  });

  it('passes health check', async () => {
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeDefined();
  });
});
