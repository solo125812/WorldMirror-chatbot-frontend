/**
 * Character Card Parser — imports V1, V2, RisuAI JSON, and PNG cards
 */

import type {
    Character,
    CreateCharacterPayload,
    CharacterCardV1,
    CharacterCardV2,
    RisuAICharacterCard,
} from '@chatbot/types';

/**
 * Detect the format of a parsed JSON object and convert to CreateCharacterPayload.
 */
export function parseCharacterCard(data: unknown): CreateCharacterPayload {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid character card data');
    }

    const obj = data as Record<string, unknown>;

    // V2 format detection: has spec and data fields
    if (obj.spec === 'chara_card_v2' && obj.data && typeof obj.data === 'object') {
        return parseV2(data as CharacterCardV2);
    }

    // RisuAI format detection: has type === 'risuai'
    if (obj.type === 'risuai' && obj.data && typeof obj.data === 'object') {
        return parseRisuAI(data as RisuAICharacterCard);
    }

    // V1 format detection: has name and first_mes (snake_case)
    if ('name' in obj && 'first_mes' in obj) {
        return parseV1(data as CharacterCardV1);
    }

    // V1 format detection: has name and firstMessage (camelCase — some variants)
    if ('name' in obj && 'firstMessage' in obj) {
        return {
            name: String(obj.name ?? ''),
            description: String(obj.description ?? ''),
            personality: String(obj.personality ?? ''),
            scenario: String(obj.scenario ?? ''),
            firstMessage: String(obj.firstMessage ?? ''),
            exampleMessages: String(obj.exampleMessages ?? obj.exampleMessage ?? ''),
            systemPrompt: String(obj.systemPrompt ?? ''),
            postHistoryInstructions: String(obj.postHistoryInstructions ?? ''),
            creatorNotes: String(obj.creatorNotes ?? ''),
            tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
            alternateGreetings: Array.isArray(obj.alternateGreetings) ? obj.alternateGreetings.map(String) : [],
        };
    }

    throw new Error('Unrecognized character card format');
}

function parseV1(card: CharacterCardV1): CreateCharacterPayload {
    return {
        name: card.name ?? '',
        description: card.description ?? '',
        personality: card.personality ?? '',
        scenario: card.scenario ?? '',
        firstMessage: card.first_mes ?? '',
        exampleMessages: card.mes_example ?? '',
    };
}

function parseV2(card: CharacterCardV2): CreateCharacterPayload {
    const d = card.data;
    return {
        name: d.name ?? '',
        description: d.description ?? '',
        personality: d.personality ?? '',
        scenario: d.scenario ?? '',
        firstMessage: d.first_mes ?? '',
        exampleMessages: d.mes_example ?? '',
        systemPrompt: d.system_prompt ?? '',
        postHistoryInstructions: d.post_history_instructions ?? '',
        creatorNotes: d.creator_notes ?? '',
        tags: d.tags ?? [],
        alternateGreetings: d.alternate_greetings ?? [],
    };
}

function parseRisuAI(card: RisuAICharacterCard): CreateCharacterPayload {
    const d = card.data;
    return {
        name: d.name ?? '',
        description: d.description ?? '',
        personality: d.personality ?? '',
        scenario: d.scenario ?? '',
        firstMessage: d.firstMessage ?? '',
        exampleMessages: d.exampleMessage ?? '',
        systemPrompt: d.systemPrompt ?? '',
        postHistoryInstructions: d.postHistoryInstructions ?? '',
        creatorNotes: d.creatorNotes ?? '',
        tags: d.tags ?? [],
        alternateGreetings: d.alternateGreetings ?? [],
    };
}

/**
 * Extract character JSON from a PNG file's tEXt chunks.
 * PNG cards embed JSON in a tEXt chunk with the keyword "chara".
 * The data is base64-encoded.
 */
export function extractCardFromPNG(buffer: Buffer): CreateCharacterPayload {
    // PNG signature: 8 bytes
    const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (buffer.subarray(0, 8).compare(PNG_SIGNATURE) !== 0) {
        throw new Error('Not a valid PNG file');
    }

    let offset = 8;

    while (offset < buffer.length) {
        const length = buffer.readUint32BE(offset);
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
        const chunkData = buffer.subarray(offset + 8, offset + 8 + length);

        if (type === 'tEXt') {
            const nullIndex = chunkData.indexOf(0);
            if (nullIndex !== -1) {
                const keyword = chunkData.subarray(0, nullIndex).toString('ascii');
                if (keyword === 'chara') {
                    const base64Data = chunkData.subarray(nullIndex + 1).toString('ascii');
                    const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
                    const parsed = JSON.parse(jsonString);
                    return parseCharacterCard(parsed);
                }
            }
        }

        if (type === 'iTXt') {
            const nullIndex = chunkData.indexOf(0);
            if (nullIndex !== -1) {
                const keyword = chunkData.subarray(0, nullIndex).toString('ascii');
                if (keyword === 'chara') {
                    // iTXt has more complex structure: keyword\0 compressionFlag compressionMethod languageTag\0 translatedKeyword\0 text
                    let pos = nullIndex + 1;
                    const compressionFlag = chunkData[pos++];
                    pos++; // compression method
                    const langEnd = chunkData.indexOf(0, pos);
                    pos = langEnd + 1;
                    const transEnd = chunkData.indexOf(0, pos);
                    pos = transEnd + 1;

                    let text: string;
                    if (compressionFlag === 0) {
                        text = chunkData.subarray(pos).toString('utf-8');
                    } else {
                        // Compressed — for now try as plain text
                        text = chunkData.subarray(pos).toString('utf-8');
                    }

                    // Try decoding as base64 first, then as plain JSON
                    try {
                        const decoded = Buffer.from(text, 'base64').toString('utf-8');
                        const parsed = JSON.parse(decoded);
                        return parseCharacterCard(parsed);
                    } catch {
                        const parsed = JSON.parse(text);
                        return parseCharacterCard(parsed);
                    }
                }
            }
        }

        // Skip to next chunk: 4 (length) + 4 (type) + length (data) + 4 (CRC)
        offset += 12 + length;
    }

    throw new Error('No character data found in PNG');
}
