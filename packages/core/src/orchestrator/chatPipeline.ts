/**
 * Chat Pipeline — Orchestrates prompt assembly and provider streaming
 * Phase 1: Simple system prompt + history + user message assembly
 */

import type { ChatMessage, CompletionParams, StreamChunk } from '@chatbot/types';
import { logger } from '@chatbot/utils';
import { ProviderRegistry } from '../providers/registry.js';

export interface PipelineOptions {
  systemPrompt?: string;
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
  assemblePrompt(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
    const assembled: ChatMessage[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      assembled.push({
        id: 'system',
        role: 'system',
        content: systemPrompt,
        createdAt: new Date().toISOString(),
      });
    }

    // Add conversation history and user message
    assembled.push(...messages);

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
    const { systemPrompt, providerId, completionParams = {} } = options;

    logger.info('Chat pipeline executing', {
      messageCount: messages.length,
      providerId: providerId ?? 'default',
    });

    try {
      // Step 1: Assemble prompt
      const assembled = this.assemblePrompt(messages, systemPrompt);

      // Step 2: Resolve provider
      const provider = this.registry.resolve(providerId);

      // Step 3: Stream response
      const params: CompletionParams = {
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
