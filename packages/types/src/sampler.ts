/**
 * Sampler and preset type definitions
 */

export interface SamplerSettings {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTokens?: number;
    repetitionPenalty?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    stopSequences?: string[];
    seed?: number;
    minP?: number;
    typicalP?: number;
}

export interface SamplerPreset {
    id: string;
    name: string;
    description: string;
    source: 'system' | 'user';
    settings: SamplerSettings;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSamplerPresetPayload {
    name: string;
    description?: string;
    settings: SamplerSettings;
}

export type UpdateSamplerPresetPayload = Partial<CreateSamplerPresetPayload>;

export const DEFAULT_SAMPLER_SETTINGS: SamplerSettings = {
    temperature: 0.8,
    topP: 0.95,
    topK: 40,
    maxTokens: 1024,
    repetitionPenalty: 1.1,
    presencePenalty: 0,
    frequencyPenalty: 0,
};
