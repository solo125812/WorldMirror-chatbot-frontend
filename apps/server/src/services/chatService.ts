/**
 * Chat Service — orchestrates chat operations
 * Phase 2: uses SQLite-backed repos, supports characters and swipes
 */

import { ChatRepo, MessageRepo } from '@chatbot/db';
import type { ChatPipeline } from '@chatbot/core';
import type { ConfigService } from './configService.js';
import type { ChatMessage } from '@chatbot/types';
import { collectStream } from '@chatbot/core';
import { logger } from '@chatbot/utils';

export class ChatService {
  constructor(
    private chatRepo: ChatRepo,
    private messageRepo: MessageRepo,
    private pipeline: ChatPipeline,
    private config: ConfigService,
  ) { }

  /**
   * Send a message and get a full (non-streaming) response.
   */
  async send(opts: {
    message: string;
    chatId?: string;
    characterId?: string;
  }): Promise<{ chatId: string; message: ChatMessage }> {
    // Create or get chat
    const chatId = opts.chatId ?? this.chatRepo.createChat({
      characterId: opts.characterId,
    }).id;

    // Store user message
    this.messageRepo.addMessage(chatId, {
      role: 'user',
      content: opts.message,
    });

    // Load conversation history
    const { messages: history } = this.messageRepo.listMessages(chatId, { limit: 100 });

    // Get config
    const appConfig = this.config.get();
    const systemPrompt = appConfig.prompt.systemPrompt;

    // Execute pipeline
    const content = await collectStream(this.pipeline.execute(history, { systemPrompt }));

    // Store assistant message
    const assistantMsg = this.messageRepo.addMessage(chatId, {
      role: 'assistant',
      content,
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
    const chatId = opts.chatId ?? this.chatRepo.createChat({
      characterId: opts.characterId,
    }).id;

    // Store user message
    this.messageRepo.addMessage(chatId, {
      role: 'user',
      content: opts.message,
    });

    // Load conversation history
    const { messages: history } = this.messageRepo.listMessages(chatId, { limit: 100 });

    // Get config
    const appConfig = this.config.get();
    const systemPrompt = appConfig.prompt.systemPrompt;

    // Stream pipeline
    let fullContent = '';
    logger.info('Chat pipeline executing', { chatId, messageCount: history.length });

    for await (const chunk of this.pipeline.execute(history, { systemPrompt })) {
      if (chunk.type === 'token' && chunk.value) {
        fullContent += chunk.value;
      }
      yield chunk;
    }

    // Store assistant message with the full content
    if (fullContent) {
      this.messageRepo.addMessage(chatId, {
        role: 'assistant',
        content: fullContent,
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
