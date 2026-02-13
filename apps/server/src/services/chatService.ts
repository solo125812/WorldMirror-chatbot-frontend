/**
 * Chat Service — orchestrates chat operations
 * Phase 3: integrates memory search, auto-capture, and context compaction
 */

import { ChatRepo, MessageRepo, CharacterRepo, SamplerPresetRepo } from '@chatbot/db';
import type { ChatPipeline } from '@chatbot/core';
import type { ConfigService } from './configService.js';
import type { ChatMessage } from '@chatbot/types';
import { collectStream, expandMacros, applyRegexRules, allocateBudget, trimHistory } from '@chatbot/core';
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
  ) { }

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
   * Send a message and get a full (non-streaming) response.
   */
  async send(opts: {
    message: string;
    chatId?: string;
    characterId?: string;
  }): Promise<{ chatId: string; message: ChatMessage }> {
    // Create or get chat
    let chat = opts.chatId ? this.chatRepo.getChat(opts.chatId) : null;
    if (!chat) {
      chat = this.chatRepo.createChat({
        characterId: opts.characterId,
        samplerPresetId: 'default',
      });
    }
    const chatId = chat.id;

    // Store user message
    this.messageRepo.addMessage(chatId, {
      role: 'user',
      content: opts.message,
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

    const regexRules = appConfig.prompt.regexRules ?? [];

    const promptMessages = history.map((m) => ({ ...m }));
    for (let i = promptMessages.length - 1; i >= 0; i--) {
      if (promptMessages[i].role === 'user') {
        let content = promptMessages[i].content;
        content = expandMacros(content, macroCtx);
        content = applyRegexRules(content, regexRules, 'user_input');
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
    const trimmedHistory = trimHistory(processedMessages, budget.history);

    // Build assembly order with memory slot
    const effectiveOrder = assemblyOrder.includes('memory')
      ? assemblyOrder
      : [...assemblyOrder.slice(0, -1), 'memory', ...assemblyOrder.slice(-1)];

    // Execute pipeline
    const content = await collectStream(
      this.pipeline.execute(trimmedHistory, {
        systemPrompt,
        persona,
        authorNote,
        memoryContext,
        assemblyOrder: effectiveOrder,
        modelId: completionParams.modelId,
        completionParams,
      })
    );

    const finalContent = applyRegexRules(content, regexRules, 'ai_output');

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
    if (!chat) {
      chat = this.chatRepo.createChat({
        characterId: opts.characterId,
        samplerPresetId: 'default',
      });
    }
    const chatId = chat.id;

    // Store user message
    this.messageRepo.addMessage(chatId, {
      role: 'user',
      content: opts.message,
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

    const regexRules = appConfig.prompt.regexRules ?? [];

    const promptMessages = history.map((m) => ({ ...m }));
    for (let i = promptMessages.length - 1; i >= 0; i--) {
      if (promptMessages[i].role === 'user') {
        let content = promptMessages[i].content;
        content = expandMacros(content, macroCtx);
        content = applyRegexRules(content, regexRules, 'user_input');
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
    const trimmedHistory = trimHistory(processedMessages, budget.history);

    // Build assembly order with memory slot
    const effectiveOrder = assemblyOrder.includes('memory')
      ? assemblyOrder
      : [...assemblyOrder.slice(0, -1), 'memory', ...assemblyOrder.slice(-1)];

    // Stream pipeline
    let fullContent = '';
    logger.info('Chat pipeline executing', { chatId, messageCount: trimmedHistory.length });

    for await (const chunk of this.pipeline.execute(trimmedHistory, {
      systemPrompt,
      persona,
      authorNote,
      memoryContext,
      assemblyOrder: effectiveOrder,
      modelId: completionParams.modelId,
      completionParams,
    })) {
      if (chunk.type === 'token' && chunk.value) {
        fullContent += chunk.value;
      }
      yield chunk;
    }

    const finalContent = applyRegexRules(fullContent, regexRules, 'ai_output');

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
