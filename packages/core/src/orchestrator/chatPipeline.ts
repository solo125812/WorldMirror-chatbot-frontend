/**
 * Chat Pipeline — Orchestrates prompt assembly and provider streaming
 * Phase 1: Simple system prompt + history + user message assembly
 */

import type { ChatMessage, CompletionParams, StreamChunk } from '@chatbot/types';
import { logger } from '@chatbot/utils';
import { ProviderRegistry } from '../providers/registry.js';

export interface PipelineOptions {
  systemPrompt?: string;
  persona?: string;
  authorNote?: string;
  memoryContext?: string;
  lorebookContext?: string;
  skillsContext?: string;
  assemblyOrder?: string[];
  modelId?: string;
  providerId?: string;
  completionParams?: Partial<CompletionParams>;
}

export class ChatPipeline {
  constructor(private registry: ProviderRegistry) {}

  /**
   * Assemble prompt from messages using Phase 1 simplified order:
   * 1. System prompt
   * 2. Conversation history
   * 3. User message (already in messages)
   */
  assemblePrompt(
    messages: ChatMessage[],
    options?: string | { systemPrompt?: string; persona?: string; authorNote?: string; memoryContext?: string; lorebookContext?: string; skillsContext?: string; assemblyOrder?: string[] }
  ): ChatMessage[] {
    const opts = typeof options === 'string' || options === undefined
      ? { systemPrompt: options }
      : options;

    const systemPrompt = opts.systemPrompt;
    const persona = opts.persona;
    const authorNote = opts.authorNote;
    const memoryContext = opts.memoryContext;
    const lorebookContext = opts.lorebookContext;
    const skillsContext = opts.skillsContext;
    const order = opts.assemblyOrder ?? ['system', 'history', 'user'];

    const assembled: ChatMessage[] = [];

    const lastUserIndex = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') return i;
      }
      return -1;
    })();
    const userMessage = lastUserIndex >= 0 ? messages[lastUserIndex] : undefined;
    const historyMessages = lastUserIndex >= 0
      ? messages.filter((_, idx) => idx !== lastUserIndex)
      : messages;

    const makeSystem = (id: string, content: string): ChatMessage => ({
      id,
      role: 'system',
      content,
      createdAt: new Date().toISOString(),
    });

    for (const slot of order) {
      switch (slot) {
        case 'system':
          if (systemPrompt) assembled.push(makeSystem('system', systemPrompt));
          break;
        case 'persona':
          if (persona) assembled.push(makeSystem('persona', persona));
          break;
        case 'author':
        case 'author_note':
          if (authorNote) assembled.push(makeSystem('author', authorNote));
          break;
        case 'memory':
          if (memoryContext) assembled.push(makeSystem('memory', memoryContext));
          break;
        case 'lorebook':
        case 'world_info':
          if (lorebookContext) assembled.push(makeSystem('lorebook', lorebookContext));
          break;
        case 'skills':
          if (skillsContext) assembled.push(makeSystem('skills', skillsContext));
          break;
        case 'history':
        case 'recent':
          assembled.push(...historyMessages);
          break;
        case 'user':
          if (userMessage) assembled.push(userMessage);
          break;
        default:
          break;
      }
    }

    return assembled;
  }

  /**
   * Execute the chat pipeline:
   * 1. Assemble prompt
   * 2. Resolve provider
   * 3. Stream response
   */
  async *execute(
    messages: ChatMessage[],
    options: PipelineOptions = {}
  ): AsyncIterable<StreamChunk> {
    const { systemPrompt, persona, authorNote, memoryContext, lorebookContext, skillsContext, assemblyOrder, providerId, modelId, completionParams = {} } = options;

    logger.info('Chat pipeline executing', {
      messageCount: messages.length,
      providerId: providerId ?? 'default',
    });

    try {
      // Step 1: Assemble prompt
      const assembled = this.assemblePrompt(messages, { systemPrompt, persona, authorNote, memoryContext, lorebookContext, skillsContext, assemblyOrder });

      // Step 2: Resolve provider
      const provider = this.registry.resolve(providerId);

      // Step 3: Stream response
      const params: CompletionParams = {
        modelId,
        temperature: completionParams.temperature ?? 1.0,
        maxTokens: completionParams.maxTokens ?? 2048,
        ...completionParams,
      };

      for await (const chunk of provider.createChatCompletion(assembled, params)) {
        yield chunk;
      }
    } catch (error) {
      logger.error('Chat pipeline error', error);
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
