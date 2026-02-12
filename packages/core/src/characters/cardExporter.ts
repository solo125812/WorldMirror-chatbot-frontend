/**
 * Character Card Exporter — export characters to V2 JSON format
 */

import type { Character, CharacterCardV2 } from '@chatbot/types';

/**
 * Export a Character to V2 JSON format (the standard interchange format).
 */
export function exportToV2(character: Character): CharacterCardV2 {
    return {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
            name: character.name,
            description: character.description,
            personality: character.personality,
            scenario: character.scenario,
            first_mes: character.firstMessage,
            mes_example: character.exampleMessages,
            system_prompt: character.systemPrompt,
            post_history_instructions: character.postHistoryInstructions,
            creator_notes: character.creatorNotes,
            tags: character.tags,
            alternate_greetings: character.alternateGreetings,
        },
    };
}

/**
 * Export a Character to a JSON string.
 */
export function exportToJSON(character: Character): string {
    return JSON.stringify(exportToV2(character), null, 2);
}
