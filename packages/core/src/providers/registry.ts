/**
 * Provider Registry — manages available LLM providers
 */

import type { LLMProvider, ModelInfo } from '@chatbot/types';
import { logger } from '@chatbot/utils';

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    logger.info(`Provider registered: ${provider.name} (${provider.id})`);
  }

  unregister(id: string): void {
    this.providers.delete(id);
  }

  get(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  async listAllModels(): Promise<ModelInfo[]> {
    const results: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      try {
        const models = await provider.listModels();
        results.push(...models);
      } catch (err) {
        logger.warn(`Failed to list models for provider ${provider.id}`, err);
      }
    }
    return results;
  }

  /**
   * Get the first available provider, or a specific one by ID
   */
  resolve(providerId?: string): LLMProvider {
    if (providerId) {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }
      return provider;
    }

    const first = this.providers.values().next();
    if (first.done) {
      throw new Error('No providers registered');
    }
    return first.value;
  }
}
