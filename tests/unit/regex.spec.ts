/**
 * Unit tests for Regex Replacement Pipeline
 */

import { describe, it, expect } from 'vitest';
import { applyRegexRules, validateRegexRule } from '@chatbot/core';
import type { RegexRule } from '@chatbot/core';

describe('applyRegexRules', () => {
    const rules: RegexRule[] = [
        { id: '1', name: 'Remove profanity', pattern: 'bad\\w*', replacement: '***', scope: 'ai_output', enabled: true },
        { id: '2', name: 'Add period', pattern: '([^.])$', replacement: '$1.', scope: 'user_input', flags: 'gm', enabled: true },
        { id: '3', name: 'Disabled rule', pattern: 'test', replacement: 'NOPE', scope: 'user_input', enabled: false },
    ];

    it('should apply rules matching the scope', () => {
        const result = applyRegexRules('That is a badword', rules, 'ai_output');
        expect(result).toBe('That is a ***');
    });

    it('should not apply rules from a different scope', () => {
        const result = applyRegexRules('That is a badword', rules, 'user_input');
        expect(result).toBe('That is a badword.');
    });

    it('should skip disabled rules', () => {
        const result = applyRegexRules('test message', rules, 'user_input');
        expect(result).toContain('test'); // Should NOT be replaced since rule is disabled
    });

    it('should handle empty text', () => {
        expect(applyRegexRules('', rules, 'ai_output')).toBe('');
    });

    it('should handle empty rules', () => {
        expect(applyRegexRules('Hello', [], 'ai_output')).toBe('Hello');
    });
});

describe('validateRegexRule', () => {
    it('should validate correct patterns', () => {
        expect(validateRegexRule({ pattern: '\\w+', flags: 'g' })).toEqual({ valid: true });
        expect(validateRegexRule({ pattern: 'hello' })).toEqual({ valid: true });
    });

    it('should reject invalid patterns', () => {
        const result = validateRegexRule({ pattern: '[invalid', flags: 'g' });
        expect(result.valid).toBe(false);
        expect(result.error).toBeTruthy();
    });
});
