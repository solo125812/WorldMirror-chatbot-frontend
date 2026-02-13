/**
 * Dependency Injection Container
 * Centralizes service creation and wiring for the server
 */

import { ProviderRegistry, MockProvider, AnthropicProvider, OllamaProvider, ChatPipeline, SkillRegistry, PromptFormatRegistry, TokenizerRegistry } from '@chatbot/core';
import { createDatabase, resetDatabase, runMigrations, ChatRepo, MessageRepo, CharacterRepo, SamplerPresetRepo, MemoryRepo, DocumentRepo, DocChunkRepo, LorebookRepo, LorebookEntryRepo, LorebookBindingRepo, GroupChatRepo, VariableRepo, RegexRuleRepo, TriggerRepo, PluginRepo, ExtensionRepo, CodeChunkRepo, IndexJobRepo, CheckpointRepo, QuickReplySetRepo, QuickReplyItemRepo } from '@chatbot/db';
import type { DatabaseClient } from '@chatbot/db';
import {
  createEmbeddingProvider,
  createVectorStore,
  FileMemory,
  MemorySearch,
  DocumentIngestor,
  AutoCaptureService,
  ContextCompactor,
} from '@chatbot/memory';
import type { EmbeddingProvider, VectorStore } from '@chatbot/memory';
import { PluginLoader, HookDispatcher } from '@chatbot/plugins';
import { ExtensionManager } from '@chatbot/extensions';
import { CodeIndexer } from '@chatbot/indexer';
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
  // Phase 3: Memory
  memoryRepo: MemoryRepo;
  documentRepo: DocumentRepo;
  docChunkRepo: DocChunkRepo;
  embeddingProvider: EmbeddingProvider;
  vectorStore: VectorStore;
  fileMemory: FileMemory | null;
  memorySearch: MemorySearch;
  documentIngestor: DocumentIngestor;
  autoCaptureService: AutoCaptureService;
  contextCompactor: ContextCompactor;
  // Phase 4: Lorebook, Group Chat, Skills, Triggers
  lorebookRepo: LorebookRepo;
  lorebookEntryRepo: LorebookEntryRepo;
  lorebookBindingRepo: LorebookBindingRepo;
  groupChatRepo: GroupChatRepo;
  variableRepo: VariableRepo;
  regexRuleRepo: RegexRuleRepo;
  triggerRepo: TriggerRepo;
  skillRegistry: SkillRegistry;
  // Phase 5: Plugins, Extensions, Indexer
  pluginRepo: PluginRepo;
  pluginLoader: PluginLoader;
  hookDispatcher: HookDispatcher;
  extensionRepo: ExtensionRepo;
  extensionManager: ExtensionManager;
  codeChunkRepo: CodeChunkRepo;
  indexJobRepo: IndexJobRepo;
  codeIndexer: CodeIndexer;
  // Phase 7: Instruct, Tokenizer, Branching, Quick Replies
  promptFormatRegistry: PromptFormatRegistry;
  tokenizerRegistry: TokenizerRegistry;
  checkpointRepo: CheckpointRepo;
  quickReplySetRepo: QuickReplySetRepo;
  quickReplyItemRepo: QuickReplyItemRepo;
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

  // Phase 3: Memory repositories
  const memoryRepo = new MemoryRepo(dbClient.db);
  const documentRepo = new DocumentRepo(dbClient.db);
  const docChunkRepo = new DocChunkRepo(dbClient.db);

  // Phase 4: Lorebook, Group Chat, Triggers repositories
  const lorebookRepo = new LorebookRepo(dbClient.db);
  const lorebookEntryRepo = new LorebookEntryRepo(dbClient.db);
  const lorebookBindingRepo = new LorebookBindingRepo(dbClient.db);
  const groupChatRepo = new GroupChatRepo(dbClient.db);
  const variableRepo = new VariableRepo(dbClient.db);
  const regexRuleRepo = new RegexRuleRepo(dbClient.db);
  const triggerRepo = new TriggerRepo(dbClient.db);

  // Phase 5: Plugins, Extensions, Indexer repositories
  const pluginRepo = new PluginRepo(dbClient.db);
  const extensionRepo = new ExtensionRepo(dbClient.db);
  const codeChunkRepo = new CodeChunkRepo(dbClient.db);
  const indexJobRepo = new IndexJobRepo(dbClient.db);

  // Phase 7: New repositories
  const checkpointRepo = new CheckpointRepo(dbClient.db);
  const quickReplySetRepo = new QuickReplySetRepo(dbClient.db);
  const quickReplyItemRepo = new QuickReplyItemRepo(dbClient.db);

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

  // Phase 3: Memory system setup
  const appConfig = configService.get();
  const memoryConfig = appConfig.memory ?? {};

  // Embedding provider — defaults to local fallback
  const embeddingConfig = {
    provider: 'local' as const,
    model: 'local-fallback',
    dimensions: 384,
    ...(memoryConfig.embedding ?? {}),
  };
  const embeddingProvider = createEmbeddingProvider(embeddingConfig as any);

  // Vector store — persisted to data/vectors.json
  const dataDir = process.env.APP_DATA_DIR
    ? resolve(process.env.APP_DATA_DIR)
    : resolve(process.cwd(), 'data');
  const vectorStore = createVectorStore({
    dimensions: embeddingProvider.dimensions(),
    persistPath: memoryConfig.vectorStore?.persistPath
      ? resolve(memoryConfig.vectorStore.persistPath)
      : resolve(dataDir, 'vectors.json'),
  });

  // File-backed memory
  let fileMemory: FileMemory | null = null;
  const fileMemoryEnabled = memoryConfig.fileMemory?.enabled !== false;
  if (fileMemoryEnabled) {
    try {
      fileMemory = new FileMemory({
        baseDir: memoryConfig.fileMemory?.baseDir
          ? resolve(memoryConfig.fileMemory.baseDir)
          : resolve(dataDir, 'memory'),
      });
    } catch (error) {
      // File memory is optional — may fail in restricted environments
      fileMemory = null;
    }
  }

  // Memory search
  const memorySearch = new MemorySearch(
    memoryRepo,
    embeddingProvider,
    vectorStore,
    fileMemory,
    docChunkRepo,
    documentRepo,
    memoryConfig.search
  );

  // Document ingestor
  const documentIngestor = new DocumentIngestor(
    documentRepo,
    docChunkRepo,
    embeddingProvider,
    vectorStore
  );

  // Auto-capture service
  const autoCaptureService = new AutoCaptureService(
    memoryRepo,
    embeddingProvider,
    vectorStore,
    fileMemory,
    memoryConfig.autoCapture
  );

  // Context compactor
  const contextCompactor = new ContextCompactor(
    memoryRepo,
    fileMemory,
    embeddingProvider,
    vectorStore,
    memoryConfig.compaction
  );

  // Phase 4: Skills registry
  const skillsDirs: Array<{ path: string; source: 'bundled' | 'managed' | 'workspace' }> = [];
  const bundledSkillsPath = resolve(__dirname, '../../../../skills');
  skillsDirs.push({ path: bundledSkillsPath, source: 'bundled' });
  // Add workspace skills dir if configured
  const workspaceSkillsPath = resolve(dataDir, 'skills');
  skillsDirs.push({ path: workspaceSkillsPath, source: 'workspace' });
  const skillRegistry = new SkillRegistry(skillsDirs);

  // Phase 5: Plugin system
  const hookDispatcher = new HookDispatcher();
  const pluginDirs = [resolve(dataDir, 'plugins')];
  const pluginLoader = new PluginLoader(pluginRepo, hookDispatcher, pluginDirs);

  // Phase 5: Extension manager
  const extensionsDir = resolve(dataDir, 'extensions');
  const extensionManager = new ExtensionManager(extensionRepo, { extensionsDir });

  // Phase 5: Code indexer
  const codeIndexer = new CodeIndexer(
    codeChunkRepo,
    indexJobRepo,
    embeddingProvider,
    vectorStore,
  );

  // Phase 7: Instruct mode and tokenizer registries
  const promptFormatRegistry = new PromptFormatRegistry();
  const tokenizerRegistry = new TokenizerRegistry();
  // Attempt to initialize tiktoken (optional dependency)
  tokenizerRegistry.initTiktoken().catch(() => {
    // js-tiktoken not installed — heuristic fallback will be used
  });

  // Create services
  const chatService = new ChatService(
    chatRepo,
    messageRepo,
    characterRepo,
    samplerPresetRepo,
    chatPipeline,
    configService,
    memorySearch,
    autoCaptureService,
    contextCompactor,
    // Phase 4 dependencies
    lorebookRepo,
    lorebookBindingRepo,
    lorebookEntryRepo,
    skillRegistry,
    variableRepo,
    regexRuleRepo,
    triggerRepo,
    hookDispatcher,
    // Phase 7: Model-aware tokenizer
    tokenizerRegistry,
  );

  container = {
    providerRegistry,
    chatPipeline,
    dbClient,
    chatRepo,
    messageRepo,
    characterRepo,
    samplerPresetRepo,
    memoryRepo,
    documentRepo,
    docChunkRepo,
    embeddingProvider,
    vectorStore,
    fileMemory,
    memorySearch,
    documentIngestor,
    autoCaptureService,
    contextCompactor,
    // Phase 4
    lorebookRepo,
    lorebookEntryRepo,
    lorebookBindingRepo,
    groupChatRepo,
    variableRepo,
    regexRuleRepo,
    triggerRepo,
    skillRegistry,
    // Phase 5
    pluginRepo,
    pluginLoader,
    hookDispatcher,
    extensionRepo,
    extensionManager,
    codeChunkRepo,
    indexJobRepo,
    codeIndexer,
    // Phase 7
    promptFormatRegistry,
    tokenizerRegistry,
    checkpointRepo,
    quickReplySetRepo,
    quickReplyItemRepo,
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
