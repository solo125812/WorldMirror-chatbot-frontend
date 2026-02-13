/**
 * @chatbot/core — Domain logic, providers, orchestration
 */

// Providers
export { ProviderRegistry } from './providers/registry.js';
export { MockProvider } from './providers/mock.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { OllamaProvider } from './providers/ollama.js';

// Orchestration
export { ChatPipeline } from './orchestrator/chatPipeline.js';
export type { PipelineOptions } from './orchestrator/chatPipeline.js';
export { formatSSE, parseSSE, collectStream } from './orchestrator/stream.js';
export { estimateTokens, allocateBudget, trimHistory } from './orchestrator/tokenBudget.js';
export type { TokenBudget, BudgetOptions } from './orchestrator/tokenBudget.js';
export { expandMacros, expandMacrosInObject } from './orchestrator/macros.js';
export type { MacroContext } from './orchestrator/macros.js';
export { applyRegexRules, validateRegexRule } from './orchestrator/regex.js';
export type { RegexRule } from './orchestrator/regex.js';

// Characters
export { parseCharacterCard, extractCardFromPNG } from './characters/cardParser.js';
export { exportToV2, exportToJSON } from './characters/cardExporter.js';

// Phase 4: Lorebook
export { activateLorebooks, formatLorebookSection } from './lorebook/activation.js';
export type { LoadedLorebook } from './lorebook/activation.js';

// Phase 4: Group Chat
export { selectNextSpeaker } from './groupChat/turnSelection.js';

// Phase 4: Skills
export { SkillRegistry } from './skills/registry.js';
export { resolveSkills, formatSkillsContext } from './skills/resolver.js';
export type { ResolvedSkills } from './skills/resolver.js';

// Phase 4: Triggers
export { executeTriggers, createTriggerContext } from './triggers/engine.js';
export type { TriggerEngineConfig } from './triggers/engine.js';
