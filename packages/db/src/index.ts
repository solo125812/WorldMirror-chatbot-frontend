/**
 * @chatbot/db — Data persistence layer
 */

export { createDatabase, getDatabase, resetDatabase, createTestDatabase, runMigrations } from './client.js';
export type { DatabaseClient } from './client.js';
export { ChatRepo } from './repositories/chatRepo.js';
export { MessageRepo } from './repositories/messageRepo.js';
export type { Swipe } from './repositories/messageRepo.js';
export { CharacterRepo } from './repositories/characterRepo.js';
export { SamplerPresetRepo } from './repositories/samplerPresetRepo.js';

// Phase 3: Memory repositories
export { MemoryRepo } from './repositories/memoryRepo.js';
export { DocumentRepo } from './repositories/documentRepo.js';
export { DocChunkRepo } from './repositories/docChunkRepo.js';

// Phase 4: Lorebook, Group Chat, Triggers repositories
export { LorebookRepo } from './repositories/lorebookRepo.js';
export { LorebookEntryRepo } from './repositories/lorebookEntryRepo.js';
export { LorebookBindingRepo } from './repositories/lorebookBindingRepo.js';
export { GroupChatRepo } from './repositories/groupChatRepo.js';
export { VariableRepo } from './repositories/variableRepo.js';
export { RegexRuleRepo } from './repositories/regexRuleRepo.js';
export { TriggerRepo } from './repositories/triggerRepo.js';

// Phase 5: Plugins, Extensions, Indexer repositories
export { PluginRepo } from './repositories/pluginRepo.js';
export { ExtensionRepo } from './repositories/extensionRepo.js';
export { CodeChunkRepo } from './repositories/codeChunkRepo.js';
export { IndexJobRepo } from './repositories/indexJobRepo.js';
