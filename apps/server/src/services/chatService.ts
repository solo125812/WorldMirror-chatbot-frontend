/**
 * Chat Service — orchestrates chat operations
 * Phase 3: integrates memory search, auto-capture, and context compaction
 * Phase 4: integrates lorebook activation, skills injection, and trigger engine
 */

import { ChatRepo, MessageRepo, CharacterRepo, SamplerPresetRepo } from '@chatbot/db';
import type { LorebookRepo, LorebookBindingRepo, LorebookEntryRepo, VariableRepo, RegexRuleRepo, TriggerRepo } from '@chatbot/db';
import type { ChatPipeline, SkillRegistry, TokenCounter } from '@chatbot/core';
import type { TokenizerRegistry } from '@chatbot/core';
import type { HookDispatcher } from '@chatbot/plugins';
import type { ConfigService } from './configService.js';
import type { ChatMessage, PluginHookEvent } from '@chatbot/types';
import {
  collectStream,
  expandMacros,
  applyRegexRules,
  allocateBudget,
  trimHistory,
  activateLorebooks,
  formatLorebookSection,
  resolveSkills,
  formatSkillsContext,
  executeTriggers,
  createTriggerContext,
} from '@chatbot/core';
import type { LoadedLorebook } from '@chatbot/core';
import type { MemorySearch, AutoCaptureService, ContextCompactor } from '@chatbot/memory';
import { formatMemoryContext } from '@chatbot/memory';
import { logger } from '@chatbot/utils';

/** Default context window when not configured */
const DEFAULT_CONTEXT_WINDOW = 8192;
/** Default combined memory search result limit */
const DEFAULT_MEMORY_SEARCH_LIMIT = 10;

export class ChatService {
  constructor(
    private chatRepo: ChatRepo,
    private messageRepo: MessageRepo,
    private characterRepo: CharacterRepo,
    private samplerPresetRepo: SamplerPresetRepo,
    private pipeline: ChatPipeline,
    private config: ConfigService,
    private memorySearch?: MemorySearch,
    private autoCaptureService?: AutoCaptureService,
    private contextCompactor?: ContextCompactor,
    // Phase 4 dependencies (optional for backward compat)
    private lorebookRepo?: LorebookRepo,
    private lorebookBindingRepo?: LorebookBindingRepo,
    private lorebookEntryRepo?: LorebookEntryRepo,
    private skillRegistry?: SkillRegistry,
    private variableRepo?: VariableRepo,
    private regexRuleRepo?: RegexRuleRepo,
    private triggerRepo?: TriggerRepo,
    private hookDispatcher?: HookDispatcher,
    // Phase 7: Model-aware tokenizer
    private tokenizerRegistry?: TokenizerRegistry,
  ) { }

  /**
   * Phase 7: Get a model-aware token counter function.
   * Falls back to the default heuristic estimateTokens if no registry.
   */
  private getTokenCounter(modelId?: string): TokenCounter | undefined {
    if (!this.tokenizerRegistry || !modelId) return undefined;
    const tokenizer = this.tokenizerRegistry.getTokenizer(modelId);
    return (text: string) => tokenizer.count(text);
  }

  private get contextWindow(): number {
    return this.config.get().memory?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  }

  private get memorySearchLimit(): number {
    return this.config.get().memory?.memorySearchLimit ?? DEFAULT_MEMORY_SEARCH_LIMIT;
  }

  private buildPersona(character?: { name?: string; description?: string; personality?: string; scenario?: string; exampleMessages?: string; systemPrompt?: string; creatorNotes?: string; }): string {
    if (!character) return '';
    const parts: string[] = [];
    if (character.description) parts.push(`Description: ${character.description}`);
    if (character.personality) parts.push(`Personality: ${character.personality}`);
    if (character.scenario) parts.push(`Scenario: ${character.scenario}`);
    if (character.exampleMessages) parts.push(`Example Dialogue:\n${character.exampleMessages}`);
    if (character.systemPrompt) parts.push(character.systemPrompt);
    if (character.creatorNotes) parts.push(`Creator Notes: ${character.creatorNotes}`);
    return parts.join('\n\n');
  }

  /**
   * Retrieve relevant memory context for the current conversation.
   */
  private async getMemoryContext(
    userMessage: string,
    characterId?: string,
    chatId?: string
  ): Promise<string> {
    if (!this.memorySearch) return '';

    try {
      // Search with appropriate scope
      const scope = characterId ? 'character' : chatId ? 'chat' : 'global';
      const sourceId = characterId ?? chatId;

      const limit = this.memorySearchLimit;
      const scopedLimit = Math.ceil(limit * 0.8);
      const globalLimit = Math.ceil(limit * 0.4);

      const results = await this.memorySearch.search({
        query: userMessage,
        scope,
        sourceId,
        limit: scopedLimit,
      });

      // Also search global scope if we searched a narrower scope
      if (scope !== 'global') {
        const globalResults = await this.memorySearch.search({
          query: userMessage,
          scope: 'global',
          limit: globalLimit,
        });
        // Merge, deduplicating by id
        for (const gr of globalResults) {
          if (!results.find((r) => r.entry.id === gr.entry.id)) {
            results.push(gr);
          }
        }
        // Re-sort by score and limit
        results.sort((a, b) => b.score - a.score);
        results.splice(limit);
      }

      return formatMemoryContext(results);
    } catch (error) {
      logger.warn('Memory retrieval failed, proceeding without memory', error);
      return '';
    }
  }

  /**
   * Run auto-capture on a message.
   */
  private async runAutoCapture(
    text: string,
    characterId?: string,
    chatId?: string
  ): Promise<void> {
    if (!this.autoCaptureService) return;

    try {
      const scope = characterId ? 'character' : chatId ? 'chat' : 'global';
      const sourceId = characterId ?? chatId;
      await this.autoCaptureService.processMessage(text, scope as any, sourceId);
    } catch (error) {
      logger.warn('Auto-capture failed', error);
    }
  }

  /**
   * Phase 4: Get lorebook context by activating lorebooks bound to the current character/chat.
   */
  private getLorebookContext(
    messages: ChatMessage[],
    characterId?: string,
    chatId?: string,
    character?: { description?: string; personality?: string; scenario?: string; systemPrompt?: string },
    authorNote?: string,
  ): string {
    const appConfig = this.config.get();
    if (!appConfig.features?.lorebook) return '';
    if (!this.lorebookBindingRepo || !this.lorebookEntryRepo || !this.lorebookRepo) return '';

    try {
      // Get bindings for this context
      const bindings = this.lorebookBindingRepo.listForContext(characterId ?? null, chatId ?? null);

      if (bindings.length === 0) return '';

      // Load lorebooks with their entries using the actual lorebook data
      const loadedLorebooks: LoadedLorebook[] = [];
      const lorebookIds = [...new Set(bindings.map((b) => b.lorebookId))];

      for (const lorebookId of lorebookIds) {
        const lorebook = this.lorebookRepo!.get(lorebookId);
        if (!lorebook) continue;
        const entries = this.lorebookEntryRepo.listByLorebook(lorebookId);
        loadedLorebooks.push({ lorebook, entries });
      }

      if (loadedLorebooks.length === 0) return '';

      const result = activateLorebooks(loadedLorebooks, {
        messages,
        characterFields: character ? {
          description: character.description,
          personality: character.personality,
          scenario: character.scenario,
          systemPrompt: character.systemPrompt,
        } : undefined,
        authorNote,
      });

      if (result.activatedCount === 0) return '';

      // Combine all activated sections into a single context string
      const allSections: string[] = [];
      for (const [, sections] of Object.entries(result.sections)) {
        if (sections.length > 0) {
          allSections.push(formatLorebookSection(sections));
        }
      }

      return allSections.join('\n\n');
    } catch (error) {
      logger.warn('Lorebook activation failed', error);
      return '';
    }
  }

  /**
   * Phase 4: Get skills context.
   */
  private getSkillsContext(): string {
    const appConfig = this.config.get();
    if (!appConfig.features?.skills) return '';
    if (!this.skillRegistry) return '';

    try {
      const resolved = resolveSkills(this.skillRegistry, appConfig);
      return formatSkillsContext(resolved);
    } catch (error) {
      logger.warn('Skills resolution failed', error);
      return '';
    }
  }

  /**
   * Phase 4: Run triggers for an activation point.
   */
  private runTriggers(
    activation: 'before_generation' | 'after_generation' | 'on_user_input' | 'on_display' | 'manual',
    messageContent: string,
    chatId?: string,
    characterId?: string,
    messageCount: number = 0,
  ): { messageContent: string; injections: Array<{ content: string; position: string }>; stopGeneration: boolean } {
    const appConfig = this.config.get();
    if (!appConfig.features?.triggers) {
      return { messageContent, injections: [], stopGeneration: false };
    }
    if (!this.triggerRepo || !this.variableRepo) {
      return { messageContent, injections: [], stopGeneration: false };
    }

    try {
      const triggers = this.triggerRepo.listForActivation(activation as any, characterId);
      if (triggers.length === 0) {
        return { messageContent, injections: [], stopGeneration: false };
      }

      const context = createTriggerContext({
        messageContent,
        chatId,
        characterId,
        messageCount,
      });

      const varRepo = this.variableRepo;
      const trigRepo = this.triggerRepo;
      const regexRepo = this.regexRuleRepo;

      executeTriggers(triggers, activation, context, {
        getVariable: (scope, key, cId) => varRepo.getValue(scope, key, cId ?? null),
        setVariable: (scope, key, value, cId) => varRepo.set(scope, key, value, cId ?? null),
        getTrigger: (id) => trigRepo.get(id),
        getRegexRule: regexRepo ? (id) => regexRepo.get(id) : undefined,
        maxTriggerDepth: 5,
      });

      return {
        messageContent: context.messageContent,
        injections: context.injections,
        stopGeneration: context.stopGeneration,
      };
    } catch (error) {
      logger.warn('Trigger execution failed', error);
      return { messageContent, injections: [], stopGeneration: false };
    }
  }

  /**
   * Phase 4: Apply DB-backed regex rules for a given placement.
   */
  private applyDbRegexRules(text: string, placement: 'user_input' | 'ai_output' | 'prompt' | 'display', characterId?: string): string {
    const appConfig = this.config.get();
    if (!appConfig.features?.triggers) return text;
    if (!this.regexRuleRepo) return text;

    try {
      const rules = this.regexRuleRepo.listForContext(characterId ?? null);
      const applicableRules = rules.filter((r) => r.placement.includes(placement as any) && r.enabled);

      let result = text;
      for (const rule of applicableRules) {
        try {
          const flags = rule.flags ?? 'g';
          const regex = new RegExp(rule.findRegex, flags);
          result = result.replace(regex, rule.replaceString);
        } catch {
          // Invalid regex — skip
        }
      }

      return result;
    } catch (error) {
      logger.warn('DB regex application failed', error);
      return text;
    }
  }

  private async dispatchHook(event: PluginHookEvent, context: Record<string, unknown>): Promise<void> {
    if (!this.hookDispatcher) return;
    try {
      await this.hookDispatcher.dispatch(event, context);
    } catch (error) {
      logger.warn('Plugin hook dispatch failed', error);
    }
  }

  /**
   * Send a message and get a full (non-streaming) response.
   */
  async send(opts: {
    message: string;
    chatId?: string;
    characterId?: string;
  }): Promise<{ chatId: string; message: ChatMessage }> {
    // Create or get chat
    let chat = opts.chatId ? this.chatRepo.getChat(opts.chatId) : null;
    const isNewChat = !chat;
    if (!chat) {
      chat = this.chatRepo.createChat({
        characterId: opts.characterId,
        samplerPresetId: 'default',
      });
      await this.dispatchHook('session_start', { chatId: chat.id, characterId: opts.characterId ?? null });
    }
    const chatId = chat.id;

    // Store user message
    this.messageRepo.addMessage(chatId, {
      role: 'user',
      content: opts.message,
    });
    await this.dispatchHook('message_received', {
      chatId,
      characterId: opts.characterId ?? chat.characterId ?? null,
      message: opts.message,
      isNewChat,
    });

    // Run auto-capture on user message
    await this.runAutoCapture(opts.message, opts.characterId ?? chat.characterId, chatId);

    // Load conversation history
    const { messages: history } = this.messageRepo.listMessages(chatId, { limit: 100 });

    // Resolve character context
    const characterId = opts.characterId ?? chat.characterId;
    const character = characterId ? this.characterRepo.getCharacter(characterId) : null;

    // Get config
    const appConfig = this.config.get();
    const assemblyOrder = character && character.useProfilePromptOrder === false && character.promptAssemblyOrder
      ? character.promptAssemblyOrder
      : appConfig.prompt.assemblyOrder;

    const modelName = chat.activeModelId ?? appConfig.activeModelId;
    const macroCtx = { userName: 'User', charName: character?.name, modelName };

    const systemPrompt = expandMacros(appConfig.prompt.systemPrompt, macroCtx);
    const persona = expandMacros(this.buildPersona(character ?? undefined), macroCtx);
    const authorNote = character?.postHistoryInstructions
      ? expandMacros(character.postHistoryInstructions, macroCtx)
      : undefined;

    // Phase 3: Retrieve memory context
    const memoryContext = await this.getMemoryContext(opts.message, characterId ?? undefined, chatId);

    // Phase 4: Lorebook activation
    const lorebookContext = this.getLorebookContext(
      history, characterId ?? undefined, chatId,
      character ?? undefined, authorNote
    );

    // Phase 4: Skills injection
    const skillsContext = this.getSkillsContext();

    // Phase 4: Run triggers on user message
    const triggerResult = this.runTriggers(
      'on_user_input', opts.message, chatId, characterId ?? undefined, history.length
    );
    if (triggerResult.stopGeneration) {
      // Return the last assistant message if generation is stopped
      const lastAssistant = history.filter((m) => m.role === 'assistant').pop();
      return { chatId, message: lastAssistant ?? history[history.length - 1] };
    }

    // Phase 4: Pre-generation triggers
    const preGenTrigger = this.runTriggers(
      'before_generation', triggerResult.messageContent, chatId, characterId ?? undefined, history.length
    );

    const regexRules = appConfig.prompt.regexRules ?? [];

    const promptMessages = history.map((m) => ({ ...m }));
    for (let i = promptMessages.length - 1; i >= 0; i--) {
      if (promptMessages[i].role === 'user') {
        let content = promptMessages[i].content;
        content = expandMacros(content, macroCtx);
        content = applyRegexRules(content, regexRules, 'user_input');
        // Phase 4: Apply DB regex rules
        content = this.applyDbRegexRules(content, 'user_input', characterId ?? undefined);
        promptMessages[i] = { ...promptMessages[i], content };
        break;
      }
    }

    const preset = this.samplerPresetRepo.get(chat.samplerPresetId ?? 'default');
    const presetSettings = (preset?.settings ?? {}) as Record<string, unknown>;
    const completionParams = {
      modelId: modelName,
      temperature: presetSettings.temperature as number | undefined,
      topP: presetSettings.topP as number | undefined,
      maxTokens: (presetSettings.maxTokens as number | undefined) ?? 1024,
      stopSequences: presetSettings.stopSequences as string[] | undefined,
    };

    // Phase 3: Context compaction check
    let processedMessages = promptMessages;
    const ctxWindow = this.contextWindow;
    if (this.contextCompactor) {
      const { messages: compactedMessages } = this.contextCompactor.compact(
        processedMessages,
        ctxWindow,
        chatId,
        characterId ?? undefined
      );
      processedMessages = compactedMessages;
    }

    const budget = allocateBudget({
      contextWindow: ctxWindow,
      maxResponseTokens: completionParams.maxTokens ?? 1024,
    });
    const tokenCounter = this.getTokenCounter(completionParams.modelId);
    const trimmedHistory = trimHistory(processedMessages, budget.history, tokenCounter);

    // Build assembly order with memory/lorebook/skills slots
    let effectiveOrder = [...assemblyOrder];
    if (!effectiveOrder.includes('memory')) {
      effectiveOrder = [...effectiveOrder.slice(0, -1), 'memory', ...effectiveOrder.slice(-1)];
    }
    if (!effectiveOrder.includes('lorebook') && lorebookContext) {
      // Insert lorebook before history
      const histIdx = effectiveOrder.indexOf('history');
      if (histIdx >= 0) {
        effectiveOrder.splice(histIdx, 0, 'lorebook');
      } else {
        effectiveOrder = [...effectiveOrder.slice(0, -1), 'lorebook', ...effectiveOrder.slice(-1)];
      }
    }
    if (!effectiveOrder.includes('skills') && skillsContext) {
      // Insert skills after system
      const sysIdx = effectiveOrder.indexOf('system');
      if (sysIdx >= 0) {
        effectiveOrder.splice(sysIdx + 1, 0, 'skills');
      } else {
        effectiveOrder.unshift('skills');
      }
    }

    await this.dispatchHook('before_generation', {
      chatId,
      characterId: characterId ?? null,
      message: triggerResult.messageContent,
    });
    await this.dispatchHook('message_sending', {
      chatId,
      characterId: characterId ?? null,
      message: triggerResult.messageContent,
    });

    // Execute pipeline
    const content = await collectStream(
      this.pipeline.execute(trimmedHistory, {
        systemPrompt,
        persona,
        authorNote,
        memoryContext,
        lorebookContext,
        skillsContext,
        assemblyOrder: effectiveOrder,
        modelId: completionParams.modelId,
        completionParams,
      })
    );

    let finalContent = applyRegexRules(content, regexRules, 'ai_output');
    // Phase 4: Apply DB regex rules to output
    finalContent = this.applyDbRegexRules(finalContent, 'ai_output', characterId ?? undefined);

    // Phase 4: Post-generation triggers
    const postGenTrigger = this.runTriggers(
      'after_generation', finalContent, chatId, characterId ?? undefined, history.length
    );
    finalContent = postGenTrigger.messageContent;

    await this.dispatchHook('after_generation', {
      chatId,
      characterId: characterId ?? null,
      response: finalContent,
    });

    // Store assistant message
    const assistantMsg = this.messageRepo.addMessage(chatId, {
      role: 'assistant',
      content: finalContent,
    });

    // Run auto-capture on assistant response
    await this.runAutoCapture(finalContent, characterId ?? undefined, chatId);

    return { chatId, message: assistantMsg };
  }

  /**
   * Stream a response as an async iterable of chunks.
   */
  async *stream(opts: {
    message: string;
    chatId?: string;
    characterId?: string;
  }): AsyncIterable<{ type: string; value?: string; message?: string }> {
    // Create or get chat
    let chat = opts.chatId ? this.chatRepo.getChat(opts.chatId) : null;
    const isNewChat = !chat;
    if (!chat) {
      chat = this.chatRepo.createChat({
        characterId: opts.characterId,
        samplerPresetId: 'default',
      });
      await this.dispatchHook('session_start', { chatId: chat.id, characterId: opts.characterId ?? null });
    }
    const chatId = chat.id;

    // Store user message
    this.messageRepo.addMessage(chatId, {
      role: 'user',
      content: opts.message,
    });
    await this.dispatchHook('message_received', {
      chatId,
      characterId: opts.characterId ?? chat.characterId ?? null,
      message: opts.message,
      isNewChat,
    });

    // Run auto-capture on user message
    await this.runAutoCapture(opts.message, opts.characterId ?? chat.characterId, chatId);

    // Load conversation history
    const { messages: history } = this.messageRepo.listMessages(chatId, { limit: 100 });

    // Resolve character context
    const characterId = opts.characterId ?? chat.characterId;
    const character = characterId ? this.characterRepo.getCharacter(characterId) : null;

    // Get config
    const appConfig = this.config.get();
    const assemblyOrder = character && character.useProfilePromptOrder === false && character.promptAssemblyOrder
      ? character.promptAssemblyOrder
      : appConfig.prompt.assemblyOrder;

    const modelName = chat.activeModelId ?? appConfig.activeModelId;
    const macroCtx = { userName: 'User', charName: character?.name, modelName };

    const systemPrompt = expandMacros(appConfig.prompt.systemPrompt, macroCtx);
    const persona = expandMacros(this.buildPersona(character ?? undefined), macroCtx);
    const authorNote = character?.postHistoryInstructions
      ? expandMacros(character.postHistoryInstructions, macroCtx)
      : undefined;

    // Phase 3: Retrieve memory context
    const memoryContext = await this.getMemoryContext(opts.message, characterId ?? undefined, chatId);

    // Phase 4: Lorebook activation
    const lorebookContext = this.getLorebookContext(
      history, characterId ?? undefined, chatId,
      character ?? undefined, authorNote
    );

    // Phase 4: Skills injection
    const skillsContext = this.getSkillsContext();

    // Phase 4: Run triggers on user message
    const triggerResult = this.runTriggers(
      'on_user_input', opts.message, chatId, characterId ?? undefined, history.length
    );
    if (triggerResult.stopGeneration) {
      yield { type: 'meta', value: chatId };
      return;
    }

    // Phase 4: Pre-generation triggers
    this.runTriggers(
      'before_generation', triggerResult.messageContent, chatId, characterId ?? undefined, history.length
    );

    const regexRules = appConfig.prompt.regexRules ?? [];

    const promptMessages = history.map((m) => ({ ...m }));
    for (let i = promptMessages.length - 1; i >= 0; i--) {
      if (promptMessages[i].role === 'user') {
        let content = promptMessages[i].content;
        content = expandMacros(content, macroCtx);
        content = applyRegexRules(content, regexRules, 'user_input');
        // Phase 4: Apply DB regex rules
        content = this.applyDbRegexRules(content, 'user_input', characterId ?? undefined);
        promptMessages[i] = { ...promptMessages[i], content };
        break;
      }
    }

    const preset = this.samplerPresetRepo.get(chat.samplerPresetId ?? 'default');
    const presetSettings = (preset?.settings ?? {}) as Record<string, unknown>;
    const completionParams = {
      modelId: modelName,
      temperature: presetSettings.temperature as number | undefined,
      topP: presetSettings.topP as number | undefined,
      maxTokens: (presetSettings.maxTokens as number | undefined) ?? 1024,
      stopSequences: presetSettings.stopSequences as string[] | undefined,
    };

    // Phase 3: Context compaction check
    let processedMessages = promptMessages;
    const ctxWindow = this.contextWindow;
    if (this.contextCompactor) {
      const { messages: compactedMessages } = this.contextCompactor.compact(
        processedMessages,
        ctxWindow,
        chatId,
        characterId ?? undefined
      );
      processedMessages = compactedMessages;
    }

    const budget = allocateBudget({
      contextWindow: ctxWindow,
      maxResponseTokens: completionParams.maxTokens ?? 1024,
    });
    const tokenCounter = this.getTokenCounter(completionParams.modelId);
    const trimmedHistory = trimHistory(processedMessages, budget.history, tokenCounter);

    // Build assembly order with memory/lorebook/skills slots
    let effectiveOrder = [...assemblyOrder];
    if (!effectiveOrder.includes('memory')) {
      effectiveOrder = [...effectiveOrder.slice(0, -1), 'memory', ...effectiveOrder.slice(-1)];
    }
    if (!effectiveOrder.includes('lorebook') && lorebookContext) {
      const histIdx = effectiveOrder.indexOf('history');
      if (histIdx >= 0) {
        effectiveOrder.splice(histIdx, 0, 'lorebook');
      } else {
        effectiveOrder = [...effectiveOrder.slice(0, -1), 'lorebook', ...effectiveOrder.slice(-1)];
      }
    }
    if (!effectiveOrder.includes('skills') && skillsContext) {
      const sysIdx = effectiveOrder.indexOf('system');
      if (sysIdx >= 0) {
        effectiveOrder.splice(sysIdx + 1, 0, 'skills');
      } else {
        effectiveOrder.unshift('skills');
      }
    }

    await this.dispatchHook('before_generation', {
      chatId,
      characterId: characterId ?? null,
      message: triggerResult.messageContent,
    });
    await this.dispatchHook('message_sending', {
      chatId,
      characterId: characterId ?? null,
      message: triggerResult.messageContent,
    });

    // Stream pipeline
    let fullContent = '';
    logger.info('Chat pipeline executing', { chatId, messageCount: trimmedHistory.length });

    for await (const chunk of this.pipeline.execute(trimmedHistory, {
      systemPrompt,
      persona,
      authorNote,
      memoryContext,
      lorebookContext,
      skillsContext,
      assemblyOrder: effectiveOrder,
      modelId: completionParams.modelId,
      completionParams,
    })) {
      if (chunk.type === 'token' && chunk.value) {
        fullContent += chunk.value;
      }
      yield chunk;
    }

    let finalContent = applyRegexRules(fullContent, regexRules, 'ai_output');
    // Phase 4: Apply DB regex rules to output
    finalContent = this.applyDbRegexRules(finalContent, 'ai_output', characterId ?? undefined);

    // Phase 4: Post-generation triggers
    const postGenTrigger = this.runTriggers(
      'after_generation', finalContent, chatId, characterId ?? undefined, history.length
    );
    finalContent = postGenTrigger.messageContent;

    await this.dispatchHook('after_generation', {
      chatId,
      characterId: characterId ?? null,
      response: finalContent,
    });

    // Store assistant message with the full content
    if (finalContent) {
      this.messageRepo.addMessage(chatId, {
        role: 'assistant',
        content: finalContent,
      });
    }

    // Run auto-capture on assistant response
    await this.runAutoCapture(finalContent, characterId ?? undefined, chatId);

    // Yield the chat ID as metadata
    yield { type: 'meta', value: chatId };
  }

  /**
   * Get a chat with its messages.
   */
  getChat(chatId: string) {
    const chat = this.chatRepo.getChat(chatId);
    if (!chat) return null;

    const { messages } = this.messageRepo.listMessages(chatId, { limit: 100 });
    return { ...chat, messages };
  }

  /**
   * List all chats.
   */
  listChats(opts: { limit?: number; offset?: number; characterId?: string } = {}) {
    return this.chatRepo.listChats(opts);
  }

  /**
   * Clear a chat and start fresh.
   */
  clearChat(chatId: string): void {
    this.messageRepo.clearMessages(chatId);
  }
}
