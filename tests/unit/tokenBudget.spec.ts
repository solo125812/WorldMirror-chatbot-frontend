/**
 * Unit tests for Token Budget Allocator
 */

import { describe, it, expect } from 'vitest';
import { estimateTokens, allocateBudget, trimHistory } from '@chatbot/core';

describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
        expect(estimateTokens('')).toBe(0);
    });

    it('should estimate tokens for short text', () => {
        const tokens = estimateTokens('Hello world');
        expect(tokens).toBeGreaterThan(2);
        expect(tokens).toBeLessThan(10);
    });

    it('should estimate tokens for longer text', () => {
        const text = 'The quick brown fox jumps over the lazy dog. This is a test sentence with multiple words.';
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(15);
        expect(tokens).toBeLessThan(40);
    });
});

describe('allocateBudget', () => {
    it('should allocate budgets correctly', () => {
        const budget = allocateBudget({
            contextWindow: 4096,
            maxResponseTokens: 1024,
        });

        expect(budget.total).toBe(4096);
        expect(budget.response).toBe(1024);
        expect(budget.system).toBe(200);
        expect(budget.persona).toBe(300);
        expect(budget.history).toBe(4096 - 1024 - 200 - 300);
    });

    it('should handle custom allocations', () => {
        const budget = allocateBudget({
            contextWindow: 8192,
            maxResponseTokens: 2048,
            systemTokens: 500,
            personaTokens: 600,
            memoryTokens: 1000,
        });

        expect(budget.system).toBe(500);
        expect(budget.persona).toBe(600);
        expect(budget.memory).toBe(1000);
        expect(budget.history).toBe(8192 - 2048 - 500 - 600 - 1000);
    });
});

describe('trimHistory', () => {
    const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there! How can I help?' },
        { role: 'user', content: 'What is the weather?' },
        { role: 'assistant', content: 'I cannot check the weather, but I can help with other things.' },
    ];

    it('should return all messages if within budget', () => {
        const result = trimHistory(messages, 10000);
        expect(result.length).toBe(5);
    });

    it('should always keep system messages', () => {
        const result = trimHistory(messages, 20);
        expect(result.some(m => m.role === 'system')).toBe(true);
    });

    it('should keep most recent messages when trimming', () => {
        const result = trimHistory(messages, 30);
        // System message should always be first
        expect(result[0].role).toBe('system');
        // Last message should be the most recent
        if (result.length > 1) {
            const lastMsg = result[result.length - 1];
            expect(lastMsg.content).toContain('cannot check');
        }
    });

    it('should return empty array for zero budget', () => {
        const result = trimHistory(messages, 0);
        expect(result).toEqual([]);
    });
});
