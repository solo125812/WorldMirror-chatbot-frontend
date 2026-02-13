/**
 * Provider-related type definitions
 */

import type { ChatMessage, ChatStreamEvent } from './chat.js';

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  /** Phase 7: ID of the tokenizer to use for this model */
  tokenizerId?: string;
  /** Phase 7: Whether this model supports logprobs */
  supportsLogprobs?: boolean;
  /** Phase 7: Whether this model supports reasoning/thinking display */
  supportsReasoning?: boolean;
  /** Phase 7: Default instruct preset ID for text-completion backends */
  instructPresetId?: string;
}

export interface CompletionParams {
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface EmbeddingParams {
  model?: string;
}

export interface HealthResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  value?: string;
  message?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  type: string;

  createChatCompletion(
    messages: ChatMessage[],
    params: CompletionParams
  ): AsyncIterable<StreamChunk>;

  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<HealthResult>;
}
