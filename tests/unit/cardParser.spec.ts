/**
 * Unit tests for Character Card Parser
 */

import { describe, it, expect } from 'vitest';
import { parseCharacterCard } from '@chatbot/core';

describe('parseCharacterCard', () => {
    it('should parse V1 JSON cards', () => {
        const v1 = {
            name: 'Alice',
            description: 'A curious girl',
            personality: 'Adventurous',
            scenario: 'Wonderland',
            first_mes: 'Hello there!',
            mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
        };

        const result = parseCharacterCard(v1);
        expect(result.name).toBe('Alice');
        expect(result.description).toBe('A curious girl');
        expect(result.personality).toBe('Adventurous');
        expect(result.scenario).toBe('Wonderland');
        expect(result.firstMessage).toBe('Hello there!');
        expect(result.exampleMessages).toBe('<START>\n{{user}}: Hi\n{{char}}: Hello!');
    });

    it('should parse V2 JSON cards', () => {
        const v2 = {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: 'Bob',
                description: 'A builder',
                personality: 'Hardworking',
                scenario: 'Construction site',
                first_mes: 'Can we fix it?',
                mes_example: '',
                system_prompt: 'You are Bob the builder.',
                post_history_instructions: 'Stay in character.',
                creator_notes: 'Fun character',
                tags: ['construction', 'kids'],
                alternate_greetings: ['Yes we can!', 'Let me get my tools.'],
            },
        };

        const result = parseCharacterCard(v2);
        expect(result.name).toBe('Bob');
        expect(result.systemPrompt).toBe('You are Bob the builder.');
        expect(result.postHistoryInstructions).toBe('Stay in character.');
        expect(result.tags).toEqual(['construction', 'kids']);
        expect(result.alternateGreetings).toEqual(['Yes we can!', 'Let me get my tools.']);
    });

    it('should parse RisuAI JSON cards', () => {
        const risuai = {
            type: 'risuai',
            data: {
                name: 'Charlie',
                description: 'A detective',
                personality: 'Observant',
                scenario: 'Mystery case',
                firstMessage: 'The game is afoot!',
                exampleMessage: '',
                systemPrompt: 'Solve mysteries.',
                postHistoryInstructions: 'Analyze clues.',
                creatorNotes: '',
                tags: ['mystery'],
                alternateGreetings: [],
            },
        };

        const result = parseCharacterCard(risuai);
        expect(result.name).toBe('Charlie');
        expect(result.firstMessage).toBe('The game is afoot!');
        expect(result.systemPrompt).toBe('Solve mysteries.');
    });

    it('should reject invalid input', () => {
        expect(() => parseCharacterCard(null)).toThrow('Invalid character card data');
        expect(() => parseCharacterCard({})).toThrow('Unrecognized character card format');
        expect(() => parseCharacterCard('string')).toThrow();
    });
});
