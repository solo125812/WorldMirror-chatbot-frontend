/**
 * Configuration type definitions
 */

export interface AppConfig {
  server: ServerConfig;
  providers: ProviderConfigEntry[];
  prompt: PromptConfig;
  activeModelId?: string;
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
  },
};
