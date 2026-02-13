/**
 * Unit tests for Context Compaction / Summarization
 */

import { describe, it, expect } from 'vitest';
import {
  needsCompaction,
  heuristicSummarize,
  estimateMessagesTokens,
  DEFAULT_COMPACTION_CONFIG,
} from '@chatbot/memory';
import type { ChatMessage } from '@chatbot/types';

function makeMsg(role: 'user' | 'assistant' | 'system', content: string, idx: number): ChatMessage {
  return {
    id: `msg-${idx}`,
    role,
    content,
    createdAt: new Date(Date.now() - (100 - idx) * 60000).toISOString(),
  };
}

describe('needsCompaction', () => {
  it('should return false when disabled', () => {
    const messages = [makeMsg('user', 'Hello', 0)];
    expect(
      needsCompaction(messages, 4096, { ...DEFAULT_COMPACTION_CONFIG, enabled: false })
    ).toBe(false);
  });

  it('should return false when tokens are below threshold', () => {
    const messages = [
      makeMsg('user', 'Hello', 0),
      makeMsg('assistant', 'Hi!', 1),
    ];
    expect(needsCompaction(messages, 4096)).toBe(false);
  });

  it('should return true when tokens exceed threshold', () => {
    // Generate many messages to fill context
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 100; i++) {
      const content = Array.from({ length: 50 }, (_, j) => `word${j}`).join(' ');
      messages.push(makeMsg(i % 2 === 0 ? 'user' : 'assistant', content, i));
    }
    // With 100 messages × ~65 tokens each = ~6500 tokens
    // Threshold at 80% of 4096 = 3277
    expect(needsCompaction(messages, 4096)).toBe(true);
  });
});

describe('estimateMessagesTokens', () => {
  it('should sum token counts across messages', () => {
    const messages = [
      makeMsg('user', 'Hello world', 0),
      makeMsg('assistant', 'Hi there, how can I help?', 1),
    ];
    const tokens = estimateMessagesTokens(messages);
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(20);
  });

  it('should return 0 for empty array', () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });
});

describe('heuristicSummarize', () => {
  it('should not compact when fewer messages than threshold', () => {
    const messages = [
      makeMsg('user', 'Hello', 0),
      makeMsg('assistant', 'Hi!', 1),
      makeMsg('user', 'How are you?', 2),
    ];

    const result = heuristicSummarize(messages, {
      ...DEFAULT_COMPACTION_CONFIG,
      preserveRecentMessages: 8,
    });

    expect(result.compactedCount).toBe(0);
    expect(result.preserved).toEqual(messages);
    expect(result.summary).toBe('');
  });

  it('should compact messages when many are present', () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push(
        makeMsg(
          i % 2 === 0 ? 'user' : 'assistant',
          `Message number ${i} with some content about topic ${i}.`,
          i
        )
      );
    }

    const result = heuristicSummarize(messages, {
      ...DEFAULT_COMPACTION_CONFIG,
      preserveRecentMessages: 8,
    });

    expect(result.compactedCount).toBeGreaterThan(0);
    expect(result.preserved.length).toBeLessThan(messages.length);
    expect(result.summary).toContain('Conversation summary');
  });

  it('should preserve first 2 and last N messages', () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 15; i++) {
      messages.push(makeMsg(i % 2 === 0 ? 'user' : 'assistant', `Msg ${i}`, i));
    }

    const result = heuristicSummarize(messages, {
      ...DEFAULT_COMPACTION_CONFIG,
      preserveRecentMessages: 4,
    });

    // First 2 messages preserved
    expect(result.preserved[0].id).toBe('msg-0');
    expect(result.preserved[1].id).toBe('msg-1');

    // Last 4 messages preserved (after summary message)
    const lastFour = result.preserved.slice(-4);
    expect(lastFour[0].id).toBe('msg-11');
    expect(lastFour[3].id).toBe('msg-14');

    // Summary message inserted
    const summaryMsg = result.preserved.find((m) => m.id === 'summary');
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg!.role).toBe('system');
  });

  it('should create summary from compacted messages', () => {
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 15; i++) {
      messages.push(
        makeMsg(
          i % 2 === 0 ? 'user' : 'assistant',
          `This is important message number ${i}.`,
          i
        )
      );
    }

    const result = heuristicSummarize(messages, {
      ...DEFAULT_COMPACTION_CONFIG,
      preserveRecentMessages: 4,
    });

    expect(result.summary).toContain('Conversation summary');
    expect(result.summary).toContain('User:');
    expect(result.summary).toContain('Assistant:');
  });
});
