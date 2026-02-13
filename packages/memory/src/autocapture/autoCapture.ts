/**
 * Auto-Capture — Rule-based trigger detection for automatic memory storage
 * 
 * Scans conversation text for patterns indicating preferences, decisions,
 * facts, and entities worth remembering.
 */

import type {
  MemoryCategory,
  MemoryScope,
  AutoCaptureConfig,
  AutoCaptureTrigger,
  CreateMemoryEntryPayload,
} from '@chatbot/types';
import type { MemoryRepo } from '@chatbot/db';
import type { EmbeddingProvider } from '../embeddings/embeddingClient.js';
import type { VectorStore } from '../vector/vectorStore.js';
import type { FileMemory } from '../file/fileMemory.js';
import { logger } from '@chatbot/utils';

/**
 * Default auto-capture triggers (from blueprint §8.4).
 */
export const DEFAULT_TRIGGERS: AutoCaptureTrigger[] = [
  {
    id: 'remember',
    name: 'Explicit Remember',
    pattern: 'remember this|remember that|don\'t forget|do not forget',
    category: 'fact',
    enabled: true,
  },
  {
    id: 'preference',
    name: 'User Preferences',
    pattern: 'i prefer|i like|i hate|i love|i want|i need',
    category: 'preference',
    enabled: true,
  },
  {
    id: 'decision',
    name: 'Decisions',
    pattern: 'we decided|let\'s use|we\'ll go with|we should use|let us use',
    category: 'decision',
    enabled: true,
  },
  {
    id: 'identity',
    name: 'Identity Statements',
    pattern: 'my .+ is|is my|i am a|i work as|i live in',
    category: 'entity',
    enabled: true,
  },
  {
    id: 'important',
    name: 'Importance Markers',
    pattern: 'always|never|important to me|crucial|essential',
    category: 'fact',
    enabled: true,
  },
  {
    id: 'email',
    name: 'Email Addresses',
    pattern: '[\\w.-]+@[\\w.-]+\\.\\w+',
    category: 'entity',
    enabled: true,
  },
  {
    id: 'phone',
    name: 'Phone Numbers',
    pattern: '\\+\\d{10,}',
    category: 'entity',
    enabled: true,
  },
];

export const DEFAULT_AUTO_CAPTURE_CONFIG: AutoCaptureConfig = {
  enabled: true,
  maxPerTurn: 3,
  deduplicationThreshold: 0.95,
  triggers: DEFAULT_TRIGGERS,
};

export interface CapturedMemory {
  content: string;
  category: MemoryCategory;
  triggerId: string;
  triggerName: string;
}

/**
 * Scan text for auto-capture triggers.
 * Returns up to maxPerTurn captured memories.
 */
export function scanForCaptures(
  text: string,
  config: AutoCaptureConfig = DEFAULT_AUTO_CAPTURE_CONFIG
): CapturedMemory[] {
  if (!config.enabled) return [];

  const captures: CapturedMemory[] = [];
  const activeTriggers = config.triggers.filter((t) => t.enabled);

  for (const trigger of activeTriggers) {
    if (captures.length >= config.maxPerTurn) break;

    try {
      const regex = new RegExp(trigger.pattern, 'gi');
      const matches = text.match(regex);
      if (!matches) continue;

      // Extract the sentence containing the match
      for (const match of matches) {
        if (captures.length >= config.maxPerTurn) break;

        const sentence = extractSentence(text, match);
        if (sentence && sentence.length > 10) {
          // Avoid duplicate captures in the same turn
          if (!captures.find((c) => c.content === sentence)) {
            captures.push({
              content: sentence,
              category: trigger.category,
              triggerId: trigger.id,
              triggerName: trigger.name,
            });
          }
        }
      }
    } catch {
      // Invalid regex pattern, skip
      logger.warn(`Invalid auto-capture pattern: ${trigger.pattern}`);
    }
  }

  return captures;
}

/**
 * Extract the sentence containing a match from the full text.
 */
function extractSentence(text: string, match: string): string {
  const index = text.toLowerCase().indexOf(match.toLowerCase());
  if (index === -1) return match;

  // Find sentence boundaries (period, question mark, exclamation, newline)
  let start = index;
  while (start > 0 && !/[.!?\n]/.test(text[start - 1])) {
    start--;
  }

  let end = index + match.length;
  while (end < text.length && !/[.!?\n]/.test(text[end])) {
    end++;
  }
  // Include the punctuation
  if (end < text.length && /[.!?]/.test(text[end])) {
    end++;
  }

  return text.slice(start, end).trim();
}

/**
 * Auto-capture service — processes conversation turns and stores memories.
 */
export class AutoCaptureService {
  private config: AutoCaptureConfig;

  constructor(
    private memoryRepo: MemoryRepo,
    private embeddingProvider: EmbeddingProvider,
    private vectorStore: VectorStore,
    private fileMemory: FileMemory | null,
    config?: Partial<AutoCaptureConfig>
  ) {
    this.config = { ...DEFAULT_AUTO_CAPTURE_CONFIG, ...config };
  }

  /**
   * Process a conversation turn for auto-capture.
   * Called after each user message or assistant response.
   */
  async processMessage(
    text: string,
    scope: MemoryScope,
    sourceId?: string
  ): Promise<CreateMemoryEntryPayload[]> {
    if (!this.config.enabled) return [];

    const captures = scanForCaptures(text, this.config);
    if (captures.length === 0) return [];

    const stored: CreateMemoryEntryPayload[] = [];

    for (const capture of captures) {
      // Check for duplicates
      const isDuplicate = await this.isDuplicate(capture.content, scope, sourceId);
      if (isDuplicate) {
        logger.info('Skipping duplicate auto-capture', {
          content: capture.content.slice(0, 50),
        });
        continue;
      }

      // Create memory entry
      const entry = this.memoryRepo.create({
        type: 'memory',
        category: capture.category,
        scope,
        sourceId,
        content: capture.content,
        importance: this.categorizeImportance(capture.category),
        autoCaptured: true,
      });

      // Generate embedding and store in vector store
      try {
        const { embeddings } = await this.embeddingProvider.embed([capture.content]);
        if (embeddings.length > 0) {
          this.vectorStore.insert(entry.id, embeddings[0], {
            type: 'memory',
            entryId: entry.id,
            category: capture.category,
            scope,
            sourceId,
          });
          this.memoryRepo.updateEmbeddingRef(entry.id, entry.id);
        }
      } catch (error) {
        logger.warn('Failed to embed auto-captured memory', error);
      }

      // Write to file-backed memory
      if (this.fileMemory) {
        this.fileMemory.write(entry);
      }

      stored.push({
        type: 'memory',
        category: capture.category,
        scope,
        sourceId,
        content: capture.content,
        importance: entry.importance,
        autoCaptured: true,
      });

      logger.info('Auto-captured memory', {
        category: capture.category,
        trigger: capture.triggerName,
        content: capture.content.slice(0, 80),
      });
    }

    return stored;
  }

  /**
   * Check if similar content already exists to avoid duplicates.
   */
  private async isDuplicate(
    content: string,
    scope: MemoryScope,
    sourceId?: string
  ): Promise<boolean> {
    try {
      // Check vector similarity
      const { embeddings } = await this.embeddingProvider.embed([content]);
      if (embeddings.length === 0) return false;

      const filter: Record<string, unknown> = { type: 'memory', scope };
      if (sourceId) filter.sourceId = sourceId;

      const similar = this.vectorStore.search(embeddings[0], 1, filter);
      if (similar.length > 0 && similar[0].score >= this.config.deduplicationThreshold) {
        return true;
      }
    } catch {
      // If embedding fails, fall back to keyword check
      const existing = this.memoryRepo.searchByContent(content, {
        scope,
        sourceId,
        limit: 1,
      });
      if (existing.length > 0 && existing[0].content === content) {
        return true;
      }
    }

    return false;
  }

  /**
   * Assign importance score based on category.
   */
  private categorizeImportance(category: MemoryCategory): number {
    switch (category) {
      case 'entity':
        return 0.8;
      case 'preference':
        return 0.7;
      case 'decision':
        return 0.9;
      case 'fact':
        return 0.6;
      default:
        return 0.5;
    }
  }

  /**
   * Get current config.
   */
  getConfig(): AutoCaptureConfig {
    return { ...this.config };
  }

  /**
   * Update config.
   */
  updateConfig(updates: Partial<AutoCaptureConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
