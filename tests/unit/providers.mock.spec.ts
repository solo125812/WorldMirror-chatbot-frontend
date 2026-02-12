/**
 * Unit tests for Mock Provider
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry, MockProvider } from '@chatbot/core';
import type { ChatMessage } from '@chatbot/types';

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  it('should have correct id and name', () => {
    expect(provider.id).toBe('mock');
    expect(provider.name).toBe('Mock Provider');
  });

  it('should list models', async () => {
    const models = await provider.listModels();

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('mock-model-1');
    expect(models[0].providerId).toBe('mock');
    expect(models[0].supportsStreaming).toBe(true);
  });

  it('should pass health check', async () => {
    const health = await provider.healthCheck();

    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeDefined();
  });

  it('should stream tokens', async () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
    ];

    const tokens: string[] = [];
    let gotDone = false;

    for await (const chunk of provider.createChatCompletion(messages, {})) {
      if (chunk.type === 'token' && chunk.value) {
        tokens.push(chunk.value);
      }
      if (chunk.type === 'done') {
        gotDone = true;
      }
    }

    expect(tokens.length).toBeGreaterThan(0);
    expect(gotDone).toBe(true);

    // Reassemble the full text
    const fullText = tokens.join('');
    expect(fullText.length).toBeGreaterThan(10);
  });
});

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should register and retrieve providers', () => {
    const mock = new MockProvider();
    registry.register(mock);

    expect(registry.get('mock')).toBe(mock);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('should resolve the default provider', () => {
    registry.register(new MockProvider());

    const resolved = registry.resolve();
    expect(resolved.id).toBe('mock');
  });

  it('should resolve by ID', () => {
    registry.register(new MockProvider());

    const resolved = registry.resolve('mock');
    expect(resolved.id).toBe('mock');
  });

  it('should throw when resolving unknown provider', () => {
    expect(() => registry.resolve('unknown')).toThrow('Provider not found');
  });

  it('should throw when no providers registered', () => {
    expect(() => registry.resolve()).toThrow('No providers registered');
  });

  it('should list all models across providers', async () => {
    registry.register(new MockProvider());
    const models = await registry.listAllModels();

    expect(models.length).toBeGreaterThan(0);
    expect(models[0].providerId).toBe('mock');
  });
});
