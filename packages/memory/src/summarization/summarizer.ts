/**
 * Summarization — Context compaction via message summarization
 * 
 * When the context window fills up, older messages are summarized
 * into compact memory entries to free up space while preserving context.
 */

import type {
  ChatMessage,
  CompactionEvent,
  CompactionConfig,
  CreateMemoryEntryPayload,
} from '@chatbot/types';
import type { MemoryRepo } from '@chatbot/db';
import type { FileMemory } from '../file/fileMemory.js';
import { estimateTokenCount } from '../ingest/chunkers.js';
import { logger, nowIso } from '@chatbot/utils';

export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  enabled: true,
  threshold: 0.8,             // 80% of context window
  preserveRecentMessages: 8,  // Keep last 8 messages
};

/**
 * Check if context compaction is needed.
 */
export function needsCompaction(
  messages: ChatMessage[],
  contextWindow: number,
  config: CompactionConfig = DEFAULT_COMPACTION_CONFIG
): boolean {
  if (!config.enabled) return false;

  const totalTokens = messages.reduce(
    (sum, m) => sum + estimateTokenCount(m.content),
    0
  );
  const threshold = contextWindow * config.threshold;

  return totalTokens > threshold;
}

/**
 * Estimate total tokens used by messages.
 */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce(
    (sum, m) => sum + estimateTokenCount(m.content),
    0
  );
}

/**
 * Perform heuristic-based summarization of messages.
 * 
 * This is a fallback when no LLM is available for summarization.
 * It creates a condensed version by:
 * 1. Preserving the first 2 messages (greeting/context)
 * 2. Extracting key points from middle messages
 * 3. Keeping the last N messages intact
 */
export function heuristicSummarize(
  messages: ChatMessage[],
  config: CompactionConfig = DEFAULT_COMPACTION_CONFIG
): { summary: string; preserved: ChatMessage[]; compactedCount: number } {
  const preserveRecent = config.preserveRecentMessages;

  if (messages.length <= preserveRecent + 2) {
    // Not enough messages to compact
    return {
      summary: '',
      preserved: messages,
      compactedCount: 0,
    };
  }

  // Keep first 2 messages and last N
  const firstMessages = messages.slice(0, 2);
  const preserved = messages.slice(-preserveRecent);
  const toSummarize = messages.slice(2, -preserveRecent);

  if (toSummarize.length === 0) {
    return {
      summary: '',
      preserved: messages,
      compactedCount: 0,
    };
  }

  // Build summary from messages to compact
  const summaryParts: string[] = [];

  for (const msg of toSummarize) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
    const content = msg.content.trim();

    // Extract key sentences (first sentence, or first 100 chars)
    const firstSentence = content.match(/^[^.!?\n]+[.!?]?/)?.[0] ?? content.slice(0, 100);
    if (firstSentence.length > 10) {
      summaryParts.push(`- ${role}: ${firstSentence}`);
    }
  }

  const summary = [
    `[Conversation summary of ${toSummarize.length} messages]`,
    ...summaryParts,
  ].join('\n');

  // Combine: first messages + summary message + preserved recent
  const summaryMessage: ChatMessage = {
    id: 'summary',
    role: 'system',
    content: summary,
    createdAt: nowIso(),
  };

  const finalMessages = [...firstMessages, summaryMessage, ...preserved];

  return {
    summary,
    preserved: finalMessages,
    compactedCount: toSummarize.length,
  };
}

/**
 * Context compaction service — manages automatic summarization.
 */
export class ContextCompactor {
  private config: CompactionConfig;

  constructor(
    private memoryRepo: MemoryRepo,
    private fileMemory: FileMemory | null,
    config?: Partial<CompactionConfig>
  ) {
    this.config = { ...DEFAULT_COMPACTION_CONFIG, ...config };
  }

  /**
   * Check and perform compaction if needed.
   * Returns the compacted messages and a compaction event if compaction occurred.
   */
  compact(
    messages: ChatMessage[],
    contextWindow: number,
    chatId: string,
    characterId?: string
  ): { messages: ChatMessage[]; event: CompactionEvent | null } {
    if (!needsCompaction(messages, contextWindow, this.config)) {
      return { messages, event: null };
    }

    const tokensBefore = estimateMessagesTokens(messages);
    const messagesBefore = messages.length;

    logger.info('Context compaction triggered', {
      chatId,
      messages: messagesBefore,
      tokens: tokensBefore,
      threshold: contextWindow * this.config.threshold,
    });

    const { summary, preserved, compactedCount } = heuristicSummarize(
      messages,
      this.config
    );

    if (compactedCount === 0) {
      return { messages, event: null };
    }

    const tokensAfter = estimateMessagesTokens(preserved);

    // Store summary as a memory entry
    if (summary) {
      const entry = this.memoryRepo.create({
        type: 'summary',
        category: 'summary',
        scope: characterId ? 'character' : 'chat',
        sourceId: characterId ?? chatId,
        content: summary,
        importance: 0.7,
        autoCaptured: true,
      });

      // Also write to file-backed memory
      if (this.fileMemory) {
        this.fileMemory.write(entry);
      }
    }

    const event: CompactionEvent = {
      timestamp: nowIso(),
      messagesBefore,
      messagesAfter: preserved.length,
      tokensBefore,
      tokensAfter,
      summary: summary.slice(0, 200),
    };

    logger.info('Context compaction complete', {
      chatId,
      messagesBefore,
      messagesAfter: preserved.length,
      tokensBefore,
      tokensAfter,
      compacted: compactedCount,
    });

    return { messages: preserved, event };
  }

  /**
   * Get current config.
   */
  getConfig(): CompactionConfig {
    return { ...this.config };
  }

  /**
   * Update config.
   */
  updateConfig(updates: Partial<CompactionConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
