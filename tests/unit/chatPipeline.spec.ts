/**
 * Unit tests for ChatPipeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry, MockProvider, ChatPipeline } from '@chatbot/core';
import type { ChatMessage } from '@chatbot/types';

describe('ChatPipeline', () => {
  let registry: ProviderRegistry;
  let pipeline: ChatPipeline;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register(new MockProvider());
    pipeline = new ChatPipeline(registry);
  });

  it('should assemble prompt with system prompt and messages', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
    ];

    const assembled = pipeline.assemblePrompt(messages, 'You are helpful.');

    expect(assembled).toHaveLength(2);
    expect(assembled[0].role).toBe('system');
    expect(assembled[0].content).toBe('You are helpful.');
    expect(assembled[1].role).toBe('user');
    expect(assembled[1].content).toBe('Hello');
  });

  it('should assemble prompt without system prompt', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hi', createdAt: new Date().toISOString() },
    ];

    const assembled = pipeline.assemblePrompt(messages);

    expect(assembled).toHaveLength(1);
    expect(assembled[0].role).toBe('user');
  });

  it('should stream tokens from mock provider', async () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
    ];

    const tokens: string[] = [];
    let gotDone = false;

    for await (const chunk of pipeline.execute(messages)) {
      if (chunk.type === 'token' && chunk.value) {
        tokens.push(chunk.value);
      }
      if (chunk.type === 'done') {
        gotDone = true;
      }
    }

    expect(tokens.length).toBeGreaterThan(0);
    expect(gotDone).toBe(true);
    expect(tokens.join('')).toBeTruthy();
  });

  it('should yield error for unregistered provider', async () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
    ];

    const emptyRegistry = new ProviderRegistry();
    const emptyPipeline = new ChatPipeline(emptyRegistry);

    const chunks: Array<{ type: string }> = [];

    for await (const chunk of emptyPipeline.execute(messages)) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type === 'error')).toBe(true);
  });
});
