/**
 * SSE Stream utilities — helpers for Server-Sent Events formatting
 */

import type { StreamChunk } from '@chatbot/types';

/**
 * Format a StreamChunk as an SSE event string
 */
export function formatSSE(chunk: StreamChunk): string {
  switch (chunk.type) {
    case 'token':
      return `event: token\ndata: ${JSON.stringify({ value: chunk.value })}\n\n`;
    case 'done':
      return `event: done\ndata: {}\n\n`;
    case 'error':
      return `event: error\ndata: ${JSON.stringify({ message: chunk.message })}\n\n`;
    default:
      return '';
  }
}

/**
 * Parse an SSE event string back into a StreamChunk
 */
export function parseSSE(raw: string): StreamChunk | null {
  const lines = raw.split('\n');
  let eventType = '';
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      data = line.slice(6).trim();
    }
  }

  if (!eventType) return null;

  try {
    const parsed = JSON.parse(data);
    switch (eventType) {
      case 'token':
        return { type: 'token', value: parsed.value };
      case 'done':
        return { type: 'done' };
      case 'error':
        return { type: 'error', message: parsed.message };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Collect all tokens from an async iterable of StreamChunks into a single string
 */
export async function collectStream(stream: AsyncIterable<StreamChunk>): Promise<string> {
  let result = '';
  for await (const chunk of stream) {
    if (chunk.type === 'token' && chunk.value) {
      result += chunk.value;
    }
    if (chunk.type === 'error') {
      throw new Error(chunk.message);
    }
  }
  return result;
}
