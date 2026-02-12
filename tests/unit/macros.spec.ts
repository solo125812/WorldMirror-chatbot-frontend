/**
 * Unit tests for Macro Expansion
 */

import { describe, it, expect } from 'vitest';
import { expandMacros } from '@chatbot/core';

describe('expandMacros', () => {
    const ctx = {
        userName: 'Alice',
        charName: 'Bob',
        modelName: 'gpt-4',
    };

    it('should expand {{user}}', () => {
        expect(expandMacros('Hello {{user}}!', ctx)).toBe('Hello Alice!');
    });

    it('should expand {{char}}', () => {
        expect(expandMacros('{{char}} says hi.', ctx)).toBe('Bob says hi.');
    });

    it('should expand {{model}}', () => {
        expect(expandMacros('Using {{model}}', ctx)).toBe('Using gpt-4');
    });

    it('should expand {{time}}', () => {
        const result = expandMacros('Time: {{time}}', ctx);
        expect(result).toMatch(/Time: \d{2}:\d{2}/);
    });

    it('should expand {{date}}', () => {
        const result = expandMacros('Date: {{date}}', ctx);
        expect(result).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
    });

    it('should expand multiple macros in one string', () => {
        const result = expandMacros('{{user}} is chatting with {{char}} via {{model}}.', ctx);
        expect(result).toBe('Alice is chatting with Bob via gpt-4.');
    });

    it('should leave unrecognized macros as-is', () => {
        expect(expandMacros('{{unknown}} macro', ctx)).toBe('{{unknown}} macro');
    });

    it('should use defaults when context values are missing', () => {
        expect(expandMacros('Hi {{user}}!', {})).toBe('Hi User!');
        expect(expandMacros('Hi {{char}}!', {})).toBe('Hi Assistant!');
        expect(expandMacros('{{model}}', {})).toBe('unknown');
    });

    it('should handle empty string', () => {
        expect(expandMacros('', ctx)).toBe('');
    });

    it('should be case-insensitive', () => {
        expect(expandMacros('{{USER}}', ctx)).toBe('Alice');
        expect(expandMacros('{{Char}}', ctx)).toBe('Bob');
    });
});
