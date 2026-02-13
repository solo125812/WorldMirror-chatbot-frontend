/**
 * Embedding Client — Unified embedding API with provider abstraction
 * 
 * Supports:
 * 1. OpenAI-compatible endpoints (OpenAI, local proxies)
 * 2. Ollama embeddings
 */

import type { EmbeddingConfig, EmbeddingResult } from '@chatbot/types';
import { logger } from '@chatbot/utils';

export interface EmbeddingProvider {
  id: string;
  name: string;
  embed(texts: string[]): Promise<EmbeddingResult>;
  dimensions(): number;
}

/**
 * OpenAI-compatible embedding provider.
 * Works with OpenAI API and any compatible endpoint.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  id = 'openai';
  name = 'OpenAI Embeddings';

  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private dims: number;

  constructor(config: EmbeddingConfig) {
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.apiKey = config.apiKey ?? '';
    this.model = config.model ?? 'text-embedding-3-small';
    this.dims = config.dimensions ?? 1536;
  }

  dimensions(): number {
    return this.dims;
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], model: this.model, tokenCount: 0 };
    }

    const url = `${this.baseUrl}/embeddings`;
    const body = {
      input: texts,
      model: this.model,
      ...(this.dims !== 1536 ? { dimensions: this.dims } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI embedding failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
      model: string;
      usage: { total_tokens: number };
    };

    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);

    return {
      embeddings: sorted.map((d) => d.embedding),
      model: data.model,
      tokenCount: data.usage.total_tokens,
    };
  }
}

/**
 * Ollama embedding provider.
 * Uses the Ollama /api/embed endpoint.
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  id = 'ollama';
  name = 'Ollama Embeddings';

  private baseUrl: string;
  private model: string;
  private dims: number;

  constructor(config: EmbeddingConfig) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
    this.model = config.model ?? 'nomic-embed-text';
    this.dims = config.dimensions ?? 768;
  }

  dimensions(): number {
    return this.dims;
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], model: this.model, tokenCount: 0 };
    }

    // Ollama supports batched embeddings via /api/embed
    const url = `${this.baseUrl}/api/embed`;
    const body = {
      model: this.model,
      input: texts,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama embedding failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      model: string;
      embeddings: number[][];
    };

    return {
      embeddings: data.embeddings,
      model: data.model,
      tokenCount: 0, // Ollama doesn't report token usage
    };
  }
}

/**
 * Create an embedding provider based on configuration.
 */
export function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIEmbeddingProvider(config);
    case 'ollama':
      return new OllamaEmbeddingProvider(config);
    case 'local':
      // Fallback to a no-op provider that uses random vectors (for testing)
      return new LocalFallbackProvider(config);
    default:
      logger.warn(`Unknown embedding provider: ${config.provider}, using fallback`);
      return new LocalFallbackProvider(config);
  }
}

/**
 * Local fallback provider that generates random-ish vectors.
 * Used for testing or when no embedding provider is configured.
 * NOT suitable for production — vectors have no semantic meaning.
 */
class LocalFallbackProvider implements EmbeddingProvider {
  id = 'local';
  name = 'Local Fallback (no semantic meaning)';

  private dims: number;

  constructor(config: EmbeddingConfig) {
    this.dims = config.dimensions ?? 384;
  }

  dimensions(): number {
    return this.dims;
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    // Generate deterministic pseudo-random vectors based on text content
    // This ensures the same text always gets the same vector
    const embeddings = texts.map((text) => {
      const vector: number[] = [];
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
      }
      for (let i = 0; i < this.dims; i++) {
        hash = ((hash << 5) - hash + i) | 0;
        vector.push(((hash & 0xffff) / 0xffff) * 2 - 1);
      }
      // Normalize
      const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
      return mag > 0 ? vector.map((v) => v / mag) : vector;
    });

    return {
      embeddings,
      model: 'local-fallback',
      tokenCount: 0,
    };
  }
}
