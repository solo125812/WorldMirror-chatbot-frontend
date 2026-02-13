/**
 * Unit tests for Tokenizer Registry
 * Phase 7 — Week 20
 */

import { describe, it, expect } from 'vitest';
import { TokenizerRegistry } from '@chatbot/core';

describe('TokenizerRegistry', () => {
  it('creates a registry with heuristic fallback', () => {
    const registry = new TokenizerRegistry();
    const tokenizers = registry.listTokenizers();
    expect(tokenizers.length).toBeGreaterThan(0);
    expect(tokenizers.find((t) => t.id === 'heuristic')).toBeDefined();
  });

  it('counts tokens with heuristic fallback', () => {
    const registry = new TokenizerRegistry();
    const result = registry.countTokens('Hello, world! This is a test message.');
    expect(result.count).toBeGreaterThan(0);
    expect(result.isApproximate).toBe(true);
    expect(result.tokenizerName).toContain('Heuristic');
  });

  it('counts tokens for empty string', () => {
    const registry = new TokenizerRegistry();
    const result = registry.countTokens('');
    expect(result.count).toBe(0);
    expect(result.isApproximate).toBe(true);
  });

  it('uses heuristic for unknown model IDs', () => {
    const registry = new TokenizerRegistry();
    const result = registry.countTokens('Hello world', 'some-unknown-model');
    expect(result.isApproximate).toBe(true);
    expect(result.tokenizerName).toContain('Heuristic');
  });

  it('returns approximate counts (~4 chars per token)', () => {
    const registry = new TokenizerRegistry();
    const text = 'a'.repeat(100); // 100 chars
    const result = registry.countTokens(text);
    // ~25 tokens + 3 overhead
    expect(result.count).toBeGreaterThanOrEqual(25);
    expect(result.count).toBeLessThanOrEqual(35);
  });

  it('heuristic handles code with special characters', () => {
    const registry = new TokenizerRegistry();
    const code = 'function hello() { return "world"; }';
    const result = registry.countTokens(code);
    expect(result.count).toBeGreaterThan(0);
    expect(result.isApproximate).toBe(true);
  });

  it('registers a custom tokenizer', () => {
    const registry = new TokenizerRegistry();
    const customTokenizer = {
      name: 'Custom',
      modelFamily: 'test',
      encode: (text: string) => Array.from(text).map((_, i) => i),
      decode: () => 'decoded',
      count: (text: string) => text.length,
    };

    registry.registerTokenizer('custom-test', customTokenizer, {
      id: 'custom-test',
      name: 'Custom Test',
      modelFamily: 'test',
      modelPatterns: ['my-model'],
      type: 'heuristic',
    });

    const result = registry.countTokens('abc', 'my-model-v1');
    expect(result.count).toBe(3); // Uses custom tokenizer (1 token per char)
    expect(result.isApproximate).toBe(false);
  });

  it('getTokenizer falls back to heuristic when no match', () => {
    const registry = new TokenizerRegistry();
    const tokenizer = registry.getTokenizer('completely-unknown-model');
    expect(tokenizer.name).toContain('Heuristic');
  });

  it('getTokenizerById returns undefined for unknown ID', () => {
    const registry = new TokenizerRegistry();
    expect(registry.getTokenizerById('nonexistent')).toBeUndefined();
  });

  it('getTokenizerById returns heuristic', () => {
    const registry = new TokenizerRegistry();
    const tokenizer = registry.getTokenizerById('heuristic');
    expect(tokenizer).toBeDefined();
    expect(tokenizer!.name).toContain('Heuristic');
  });

  it('getInitializedTokenizers returns empty initially (no tiktoken)', () => {
    const registry = new TokenizerRegistry();
    expect(registry.getInitializedTokenizers()).toEqual([]);
  });
});
