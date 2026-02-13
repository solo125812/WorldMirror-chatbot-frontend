/**
 * Chat Service — orchestrates chat operations
 * Phase 2: uses SQLite-backed repos, supports characters and swipes
 */

import { ChatRepo, MessageRepo, CharacterRepo, SamplerPresetRepo } from '@chatbot/db';
import type { ChatPipeline } from '@chatbot/core';
import type { ConfigService } from './configService.js';
import type { ChatMessage } from '@chatbot/types';
import { collectStream, expandMacros, applyRegexRules, allocateBudget, trimHistory } from '@chatbot/core';
import { logger } from '@chatbot/utils';

export class ChatService {
  constructor(
    private chatRepo: ChatRepo,
    private messageRepo: MessageRepo,
    private characterRepo: CharacterRepo,
    private samplerPresetRepo: SamplerPresetRepo,
    private pipeline: ChatPipeline,
    private config: ConfigService,
  ) { }

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

    const budget = allocateBudget({
      contextWindow: 8192,
      maxResponseTokens: completionParams.maxTokens ?? 1024,
    });
    const trimmedHistory = trimHistory(promptMessages, budget.history);

    // Execute pipeline
    const content = await collectStream(
      this.pipeline.execute(trimmedHistory, {
        systemPrompt,
        persona,
        authorNote,
        assemblyOrder,
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

    const budget = allocateBudget({
      contextWindow: 8192,
      maxResponseTokens: completionParams.maxTokens ?? 1024,
    });
    const trimmedHistory = trimHistory(promptMessages, budget.history);

    // Stream pipeline
    let fullContent = '';
    logger.info('Chat pipeline executing', { chatId, messageCount: trimmedHistory.length });

    for await (const chunk of this.pipeline.execute(trimmedHistory, {
      systemPrompt,
      persona,
      authorNote,
      assemblyOrder,
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
