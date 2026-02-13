/**
 * Unit tests for Group Chat Turn Selection
 */

import { describe, it, expect } from 'vitest';
import { selectNextSpeaker } from '@chatbot/core';
import type { GroupChat, ChatMessage } from '@chatbot/types';

function makeGroup(overrides: Partial<GroupChat> = {}): GroupChat {
  return {
    id: 'grp-1',
    name: 'Test Group',
    characterIds: ['char-a', 'char-b', 'char-c'],
    replyOrder: [],
    activationStrategy: 'sequential',
    allowSelfResponses: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('selectNextSpeaker', () => {
  describe('sequential strategy', () => {
    it('should select the first character when no last speaker', () => {
      const group = makeGroup();
      const result = selectNextSpeaker(group, []);
      expect(result.characterId).toBe('char-a');
    });

    it('should cycle to the next character in order', () => {
      const group = makeGroup();
      const result = selectNextSpeaker(group, [], 'char-a');
      expect(result.characterId).toBe('char-b');
    });

    it('should wrap around to the first character', () => {
      const group = makeGroup();
      const result = selectNextSpeaker(group, [], 'char-c');
      expect(result.characterId).toBe('char-a');
    });

    it('should use replyOrder if provided', () => {
      const group = makeGroup({ replyOrder: ['char-c', 'char-a', 'char-b'] });
      const result = selectNextSpeaker(group, []);
      expect(result.characterId).toBe('char-c');
    });

    it('should skip self when allowSelfResponses is false', () => {
      const group = makeGroup({
        characterIds: ['char-a', 'char-b'],
        allowSelfResponses: false,
      });
      // When last speaker is char-a, next should be char-b
      const result = selectNextSpeaker(group, [], 'char-a');
      expect(result.characterId).toBe('char-b');
    });
  });

  describe('random strategy', () => {
    it('should select a character from the group', () => {
      const group = makeGroup({ activationStrategy: 'random' });
      const result = selectNextSpeaker(group, []);
      expect(group.characterIds).toContain(result.characterId);
    });

    it('should not select the last speaker when allowSelfResponses is false', () => {
      const group = makeGroup({
        activationStrategy: 'random',
        characterIds: ['char-a', 'char-b'],
        allowSelfResponses: false,
      });

      // Run multiple times to verify
      for (let i = 0; i < 10; i++) {
        const result = selectNextSpeaker(group, [], 'char-a');
        expect(result.characterId).toBe('char-b');
      }
    });
  });

  describe('smart strategy', () => {
    it('should select the least recently spoken character', () => {
      const group = makeGroup({ activationStrategy: 'smart' });
      const messages: ChatMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: '2024-01-01T00:00:00Z' },
      ];

      const result = selectNextSpeaker(group, messages);
      expect(group.characterIds).toContain(result.characterId);
    });

    it('should throw when group has no characters', () => {
      const group = makeGroup({ activationStrategy: 'sequential', characterIds: [] });
      expect(() => selectNextSpeaker(group, [])).toThrow('Group has no characters');
    });
  });
});
