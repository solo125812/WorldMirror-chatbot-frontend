/**
 * Configuration type definitions
 */

import type { AutoCaptureConfig, CompactionConfig, EmbeddingConfig } from './memory.js';

export interface AppConfig {
  server: ServerConfig;
  providers: ProviderConfigEntry[];
  prompt: PromptConfig;
  activeModelId?: string;
  memory?: MemoryConfig;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: boolean;
}

export interface ProviderConfigEntry {
  id: string;
  type: ProviderType;
  name: string;
  enabled: boolean;
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
}

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'openrouter'
  | 'mock';

export interface PromptConfig {
  systemPrompt: string;
  assemblyOrder: string[];
  regexRules?: RegexRule[];
}

export interface MemoryConfig {
  embedding?: EmbeddingConfig;
  autoCapture?: Partial<AutoCaptureConfig>;
  compaction?: Partial<CompactionConfig>;
  /** Default context window size for compaction and budgeting */
  contextWindow?: number;
  /** Max combined results from scoped + global memory search */
  memorySearchLimit?: number;
  fileMemory?: {
    enabled?: boolean;
    baseDir?: string;
  };
  search?: {
    defaultLimit?: number;
    minScore?: number;
    recencyWindowDays?: number;
  };
  vectorStore?: {
    persistPath?: string;
  };
}

export interface RegexRule {
  id: string;
  name: string;
  pattern: string;
  replacement: string;
  scope: 'user_input' | 'ai_output';
  flags?: string;
  enabled: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  server: {
    port: 3001,
    host: 'localhost',
    cors: true,
  },
  providers: [
    {
      id: 'mock',
      type: 'mock',
      name: 'Mock Provider',
      enabled: true,
    },
  ],
  prompt: {
    systemPrompt: 'You are a helpful AI assistant.',
    assemblyOrder: ['system', 'history', 'user'],
    regexRules: [],
  },
  memory: {},
};
