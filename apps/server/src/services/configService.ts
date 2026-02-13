/**
 * Configuration Service — loads, validates, and persists config
 * Phase 1: File-backed persistence with Zod validation
 */

import { z } from 'zod';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { AppConfig } from '@chatbot/types';
import { DEFAULT_CONFIG } from '@chatbot/types';
import { logger } from '@chatbot/utils';

const ServerConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3001),
  host: z.string().default('localhost'),
  cors: z.boolean().default(true),
});

const ProviderConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['openai', 'anthropic', 'google', 'ollama', 'openrouter', 'mock']),
  name: z.string(),
  enabled: z.boolean(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  models: z.array(z.string()).optional(),
});

const RegexRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  pattern: z.string(),
  replacement: z.string(),
  scope: z.enum(['user_input', 'ai_output']),
  flags: z.string().optional(),
  enabled: z.boolean(),
});

const PromptConfigSchema = z.object({
  systemPrompt: z.string().default('You are a helpful AI assistant.'),
  assemblyOrder: z.array(z.string()).default(['system', 'history', 'user']),
  regexRules: z.array(RegexRuleSchema).default([]),
});

const AppConfigSchema = z.object({
  server: ServerConfigSchema,
  providers: z.array(ProviderConfigSchema),
  prompt: PromptConfigSchema,
  activeModelId: z.string().optional(),
});

export class ConfigService {
  private config: AppConfig;
  private configPath: string;

  constructor(initial?: Partial<AppConfig>) {
    this.configPath = this.resolveConfigPath();
    const diskConfig = this.loadFromDisk();
    this.config = this.validate({ ...DEFAULT_CONFIG, ...diskConfig, ...initial });
    logger.info('Config service initialized');
  }

  get(): AppConfig {
    return { ...this.config };
  }

  update(patch: Partial<AppConfig>): AppConfig {
    const merged = {
      ...this.config,
      ...patch,
      server: { ...this.config.server, ...(patch.server ?? {}) },
      prompt: { ...this.config.prompt, ...(patch.prompt ?? {}) },
      providers: patch.providers ?? this.config.providers,
    };

    this.config = this.validate(merged);
    logger.info('Config updated');

    this.persist();
    return this.get();
  }

  private validate(data: unknown): AppConfig {
    const result = AppConfigSchema.parse(data);
    return result as AppConfig;
  }

  private resolveConfigPath(): string {
    const baseDir = process.env.APP_DATA_DIR
      ? resolve(process.env.APP_DATA_DIR)
      : resolve(process.cwd(), 'data');
    return join(baseDir, 'config.json');
  }

  private ensureDir(): void {
    const dir = resolve(this.configPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private loadFromDisk(): Partial<AppConfig> | null {
    try {
      if (!existsSync(this.configPath)) return null;
      const raw = readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (err) {
      logger.warn('Failed to load config from disk, using defaults', err);
      return null;
    }
  }

  private persist(): void {
    try {
      this.ensureDir();
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to persist config', err);
    }
  }
}
