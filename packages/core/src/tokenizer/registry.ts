/**
 * Tokenizer Registry — Model-aware token counting
 * Phase 7 — Week 20
 *
 * Provides accurate token counting when tokenizer adapters are available,
 * with a built-in heuristic fallback for unknown models.
 */

import type { Tokenizer, TokenizerInfo } from '@chatbot/types';

// ─── Heuristic Tokenizer ─────────────────────────────────────────

/**
 * Heuristic tokenizer using character-based approximation.
 * ~4 characters ≈ 1 token for English text (conservative estimate).
 * More accurate than word-based: handles code, URLs, punctuation better.
 */
class HeuristicTokenizer implements Tokenizer {
  name = 'Heuristic (≈4 chars/token)';
  modelFamily = 'fallback';

  encode(text: string): number[] {
    // Return pseudo-tokens (just sequential IDs)
    const count = this.count(text);
    return Array.from({ length: count }, (_, i) => i);
  }

  decode(_tokens: number[]): string {
    // Cannot meaningfully decode heuristic tokens
    return '[heuristic tokenizer: decode not supported]';
  }

  count(text: string): number {
    if (!text) return 0;
    // ~4 characters per token, plus a small overhead for special tokens
    return Math.ceil(text.length / 4) + 3;
  }
}

// ─── Tiktoken Adapter ────────────────────────────────────────────

/**
 * Adapter for tiktoken-based tokenizers (cl100k_base, o200k_base).
 * Requires optional `js-tiktoken` dependency.
 */
class TiktokenAdapter implements Tokenizer {
  name: string;
  modelFamily: string;
  private encoder: { encode: (text: string) => number[]; decode: (tokens: number[]) => string } | null = null;
  private encoding: string;

  constructor(encoding: string, modelFamily: string) {
    this.encoding = encoding;
    this.name = `Tiktoken (${encoding})`;
    this.modelFamily = modelFamily;
  }

  private async loadEncoder(): Promise<void> {
    if (this.encoder) return;
    try {
      // Dynamic import of js-tiktoken (optional dependency)
      const tiktoken = await import('js-tiktoken');
      this.encoder = tiktoken.encodingForModel(this.encoding as any);
    } catch {
      // Fallback: js-tiktoken not installed
      this.encoder = null;
    }
  }

  encode(text: string): number[] {
    if (!this.encoder) {
      // Fall back to heuristic if encoder not loaded
      return new HeuristicTokenizer().encode(text);
    }
    return Array.from(this.encoder.encode(text));
  }

  decode(tokens: number[]): string {
    if (!this.encoder) {
      return '[tiktoken not loaded]';
    }
    return this.encoder.decode(tokens);
  }

  count(text: string): number {
    if (!this.encoder) {
      return new HeuristicTokenizer().count(text);
    }
    return this.encoder.encode(text).length;
  }

  /**
   * Attempt to load the tiktoken encoder. Call once before use.
   */
  async init(): Promise<boolean> {
    await this.loadEncoder();
    return this.encoder !== null;
  }
}

// ─── Registry ────────────────────────────────────────────────────

/**
 * Built-in tokenizer metadata for model matching.
 */
const BUILTIN_TOKENIZERS: TokenizerInfo[] = [
  {
    id: 'cl100k_base',
    name: 'cl100k_base (GPT-4, GPT-3.5)',
    modelFamily: 'openai',
    modelPatterns: ['gpt-4(?!o)', 'gpt-3\\.5', 'gpt-35', 'text-embedding-ada'],
    type: 'tiktoken',
  },
  {
    id: 'o200k_base',
    name: 'o200k_base (GPT-4o, o1, o3)',
    modelFamily: 'openai',
    modelPatterns: ['gpt-4o', 'o1', 'o3', 'chatgpt'],
    type: 'tiktoken',
  },
  {
    id: 'claude',
    name: 'Claude (cl100k approx)',
    modelFamily: 'anthropic',
    modelPatterns: ['claude'],
    type: 'tiktoken',
  },
  {
    id: 'llama',
    name: 'Llama (SentencePiece)',
    modelFamily: 'llama',
    modelPatterns: ['llama', 'codellama', 'mistral', 'mixtral'],
    type: 'sentencepiece',
  },
  {
    id: 'heuristic',
    name: 'Heuristic Fallback',
    modelFamily: 'fallback',
    modelPatterns: ['.*'],
    type: 'heuristic',
  },
];

export class TokenizerRegistry {
  private tokenizers: Map<string, Tokenizer> = new Map();
  private tokenizerInfo: TokenizerInfo[] = [];
  private heuristic: HeuristicTokenizer;
  private initialized: Set<string> = new Set();

  constructor() {
    this.heuristic = new HeuristicTokenizer();
    this.tokenizerInfo = [...BUILTIN_TOKENIZERS];

    // Register the heuristic tokenizer immediately (always available)
    this.tokenizers.set('heuristic', this.heuristic);
  }

  /**
   * Get the best tokenizer for a given model ID.
   * Falls back to heuristic if no specific tokenizer is available.
   */
  getTokenizer(modelId: string): Tokenizer {
    const info = this.findMatchingInfo(modelId);
    if (info && this.tokenizers.has(info.id)) {
      return this.tokenizers.get(info.id)!;
    }
    return this.heuristic;
  }

  /**
   * Get a tokenizer by its ID.
   */
  getTokenizerById(id: string): Tokenizer | undefined {
    return this.tokenizers.get(id);
  }

  /**
   * Count tokens in text using the best tokenizer for the model.
   */
  countTokens(text: string, modelId?: string): { count: number; isApproximate: boolean; tokenizerName: string } {
    if (!modelId) {
      return {
        count: this.heuristic.count(text),
        isApproximate: true,
        tokenizerName: this.heuristic.name,
      };
    }

    const tokenizer = this.getTokenizer(modelId);
    return {
      count: tokenizer.count(text),
      isApproximate: tokenizer === this.heuristic,
      tokenizerName: tokenizer.name,
    };
  }

  /**
   * Initialize tiktoken-based tokenizers if the library is available.
   * Call once at startup to check optional dependency availability.
   */
  async initTiktoken(): Promise<boolean> {
    try {
      // Try to create and initialize cl100k_base
      const cl100k = new TiktokenAdapter('gpt-4', 'openai');
      const ok = await cl100k.init();
      if (ok) {
        this.tokenizers.set('cl100k_base', cl100k);
        this.initialized.add('cl100k_base');

        // Also use cl100k for Claude (approximate)
        this.tokenizers.set('claude', cl100k);
        this.initialized.add('claude');

        // Try o200k_base
        const o200k = new TiktokenAdapter('gpt-4o', 'openai');
        const o200kOk = await o200k.init();
        if (o200kOk) {
          this.tokenizers.set('o200k_base', o200k);
          this.initialized.add('o200k_base');
        }
      }
      return ok;
    } catch {
      return false;
    }
  }

  /**
   * Register a custom tokenizer.
   */
  registerTokenizer(id: string, tokenizer: Tokenizer, info?: TokenizerInfo): void {
    this.tokenizers.set(id, tokenizer);
    if (info) {
      // Prepend to give custom tokenizers priority
      this.tokenizerInfo.unshift(info);
    }
  }

  /**
   * List available tokenizer information.
   */
  listTokenizers(): TokenizerInfo[] {
    return [...this.tokenizerInfo];
  }

  /**
   * Check which tokenizers have been successfully initialized.
   */
  getInitializedTokenizers(): string[] {
    return Array.from(this.initialized);
  }

  /**
   * Find the best matching tokenizer info for a model ID.
   */
  private findMatchingInfo(modelId: string): TokenizerInfo | undefined {
    const lowerModelId = modelId.toLowerCase();
    for (const info of this.tokenizerInfo) {
      if (info.id === 'heuristic') continue; // Skip heuristic in matching
      for (const pattern of info.modelPatterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(lowerModelId)) {
            return info;
          }
        } catch {
          if (lowerModelId.includes(pattern.toLowerCase())) {
            return info;
          }
        }
      }
    }
    return undefined;
  }
}
