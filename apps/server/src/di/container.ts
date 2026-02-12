/**
 * Dependency Injection Container
 * Centralizes service creation and wiring for the server
 */

import { ProviderRegistry, MockProvider, ChatPipeline } from '@chatbot/core';
import { createDatabase, resetDatabase, runMigrations, ChatRepo, MessageRepo, CharacterRepo, SamplerPresetRepo } from '@chatbot/db';
import type { DatabaseClient } from '@chatbot/db';
import { ConfigService } from '../services/configService.js';
import { ChatService } from '../services/chatService.js';
import { resolve } from 'node:path';

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

  // Initialize database and run migrations
  const dbClient = createDatabase();
  const migrationsDir = resolve(import.meta.dirname ?? __dirname, '../../migrations');
  runMigrations(dbClient.db, migrationsDir);

  // Create repositories
  const chatRepo = new ChatRepo(dbClient.db);
  const messageRepo = new MessageRepo(dbClient.db);
  const characterRepo = new CharacterRepo(dbClient.db);
  const samplerPresetRepo = new SamplerPresetRepo(dbClient.db);

  // Create provider registry and register mock provider
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(new MockProvider());

  // Create chat pipeline
  const chatPipeline = new ChatPipeline(providerRegistry);

  // Create services
  const configService = new ConfigService();
  const chatService = new ChatService(chatRepo, messageRepo, chatPipeline, configService);

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
