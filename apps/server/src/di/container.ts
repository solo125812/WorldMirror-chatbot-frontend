/**
 * Dependency Injection Container
 * Centralizes service creation and wiring for the server
 */

import { ProviderRegistry, MockProvider, AnthropicProvider, OllamaProvider, ChatPipeline } from '@chatbot/core';
import { createDatabase, resetDatabase, runMigrations, ChatRepo, MessageRepo, CharacterRepo, SamplerPresetRepo } from '@chatbot/db';
import type { DatabaseClient } from '@chatbot/db';
import { ConfigService } from '../services/configService.js';
import { ChatService } from '../services/chatService.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Container {
  providerRegistry: ProviderRegistry;
  chatPipeline: ChatPipeline;
  dbClient: DatabaseClient;
  chatRepo: ChatRepo;
  messageRepo: MessageRepo;
  characterRepo: CharacterRepo;
  samplerPresetRepo: SamplerPresetRepo;
  configService: ConfigService;
  chatService: ChatService;
}

let container: Container | null = null;

export function createContainer(): Container {
  if (container) return container;

  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Initialize database and run migrations
  const dbClient = createDatabase();
  const migrationsDir = resolve(__dirname, '../../migrations');
  runMigrations(dbClient.db, migrationsDir);

  // Create repositories
  const chatRepo = new ChatRepo(dbClient.db);
  const messageRepo = new MessageRepo(dbClient.db);
  const characterRepo = new CharacterRepo(dbClient.db);
  const samplerPresetRepo = new SamplerPresetRepo(dbClient.db);

  // Create config service
  const configService = new ConfigService();

  // Create provider registry and register providers from config
  const providerRegistry = new ProviderRegistry();
  const providerConfigs = configService.get().providers ?? [];

  for (const provider of providerConfigs) {
    if (!provider.enabled) continue;

    switch (provider.type) {
      case 'mock':
        providerRegistry.register(new MockProvider());
        break;
      case 'anthropic':
        if (!provider.apiKey) {
          // Skip if missing credentials
          break;
        }
        providerRegistry.register(new AnthropicProvider({ apiKey: provider.apiKey, baseUrl: provider.baseUrl }));
        break;
      case 'ollama':
        providerRegistry.register(new OllamaProvider({ baseUrl: provider.baseUrl }));
        break;
      default:
        // Provider type not implemented in Phase 2
        break;
    }
  }

  if (providerRegistry.getAll().length === 0) {
    providerRegistry.register(new MockProvider());
  }

  // Create chat pipeline
  const chatPipeline = new ChatPipeline(providerRegistry);

  // Create services
  const chatService = new ChatService(chatRepo, messageRepo, characterRepo, samplerPresetRepo, chatPipeline, configService);

  container = {
    providerRegistry,
    chatPipeline,
    dbClient,
    chatRepo,
    messageRepo,
    characterRepo,
    samplerPresetRepo,
    configService,
    chatService,
  };

  return container;
}

export function getContainer(): Container {
  if (!container) {
    throw new Error('Container not initialized. Call createContainer() first.');
  }
  return container;
}

/**
 * Reset the container singleton.
 * Call in test teardown to prevent state leaking between suites.
 */
export function resetContainer(): void {
  if (container) {
    try {
      container.dbClient.close();
    } catch {
      // Ignore close errors
    }
  }
  container = null;
  resetDatabase();
}
