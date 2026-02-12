/**
 * Unit tests for SSE stream utilities
 */

import { describe, it, expect } from 'vitest';
import { formatSSE, parseSSE, collectStream } from '@chatbot/core';
import type { StreamChunk } from '@chatbot/types';

describe('formatSSE', () => {
  it('should format token events', () => {
    const result = formatSSE({ type: 'token', value: 'Hello' });
    expect(result).toBe('event: token\ndata: {"value":"Hello"}\n\n');
  });

  it('should format done events', () => {
    const result = formatSSE({ type: 'done' });
    expect(result).toBe('event: done\ndata: {}\n\n');
  });

  it('should format error events', () => {
    const result = formatSSE({ type: 'error', message: 'fail' });
    expect(result).toBe('event: error\ndata: {"message":"fail"}\n\n');
  });
});

describe('parseSSE', () => {
  it('should parse token events', () => {
    const result = parseSSE('event: token\ndata: {"value":"Hi"}');
    expect(result).toEqual({ type: 'token', value: 'Hi' });
  });

  it('should parse done events', () => {
    const result = parseSSE('event: done\ndata: {}');
    expect(result).toEqual({ type: 'done' });
  });

  it('should parse error events', () => {
    const result = parseSSE('event: error\ndata: {"message":"oops"}');
    expect(result).toEqual({ type: 'error', message: 'oops' });
  });

  it('should return null for invalid input', () => {
    const result = parseSSE('garbage');
    expect(result).toBeNull();
  });
});

describe('collectStream', () => {
  it('should collect tokens into a string', async () => {
    async function* mockStream(): AsyncIterable<StreamChunk> {
      yield { type: 'token', value: 'Hello' };
      yield { type: 'token', value: ' world' };
      yield { type: 'done' };
    }

    const result = await collectStream(mockStream());
    expect(result).toBe('Hello world');
  });

  it('should throw on error chunks', async () => {
    async function* mockStream(): AsyncIterable<StreamChunk> {
      yield { type: 'token', value: 'Hi' };
      yield { type: 'error', message: 'Something went wrong' };
    }

    await expect(collectStream(mockStream())).rejects.toThrow('Something went wrong');
  });
});
