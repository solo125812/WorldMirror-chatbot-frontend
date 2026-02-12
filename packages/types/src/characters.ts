/**
 * Character type definitions
 */

export interface Character {
    id: string;
    name: string;
    description: string;
    personality: string;
    scenario: string;
    firstMessage: string;
    exampleMessages: string;
    systemPrompt: string;
    postHistoryInstructions: string;
    creatorNotes: string;
    tags: string[];
    avatar: string | null;
    alternateGreetings: string[];
    promptAssemblyOrder: string[] | null;
    useProfilePromptOrder: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCharacterPayload {
    name: string;
    description?: string;
    personality?: string;
    scenario?: string;
    firstMessage?: string;
    exampleMessages?: string;
    systemPrompt?: string;
    postHistoryInstructions?: string;
    creatorNotes?: string;
    tags?: string[];
    avatar?: string | null;
    alternateGreetings?: string[];
    promptAssemblyOrder?: string[] | null;
    useProfilePromptOrder?: boolean;
}

export type UpdateCharacterPayload = Partial<CreateCharacterPayload>;

/**
 * Character card formats for import/export
 */
export interface CharacterCardV1 {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
}

export interface CharacterCardV2 {
    spec: 'chara_card_v2';
    spec_version: '2.0';
    data: {
        name: string;
        description: string;
        personality: string;
        scenario: string;
        first_mes: string;
        mes_example: string;
        system_prompt: string;
        post_history_instructions: string;
        creator_notes: string;
        tags: string[];
        alternate_greetings: string[];
        creator?: string;
        character_version?: string;
        extensions?: Record<string, unknown>;
    };
}

export interface RisuAICharacterCard {
    type: 'risuai';
    data: {
        name: string;
        description: string;
        personality: string;
        scenario: string;
        firstMessage: string;
        exampleMessage: string;
        systemPrompt: string;
        postHistoryInstructions: string;
        creatorNotes: string;
        tags: string[];
        alternateGreetings: string[];
    };
}
