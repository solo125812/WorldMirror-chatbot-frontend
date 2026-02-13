/**
 * Plugin manifest validation using Zod — §11.4
 */

import { z } from 'zod';
import type { PluginManifest } from '@chatbot/types';

const pluginPermissionSchema = z.enum([
  'network',
  'filesystem:read',
  'filesystem:write',
  'memory:read',
  'memory:write',
  'tools:register',
  'dom:access',
  'settings:read',
  'settings:write',
]);

const configFieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
  label: z.string(),
  sensitive: z.boolean().optional(),
  placeholder: z.string().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const uiHintSchema = z.object({
  label: z.string(),
  sensitive: z.boolean().optional(),
  help: z.string().optional(),
});

export const pluginManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Plugin ID must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Version must be semver (e.g. 1.0.0)'),
  description: z.string().default(''),
  entry: z.string().min(1),
  permissions: z.array(pluginPermissionSchema).default([]),
  configSchema: z.record(z.string(), configFieldSchema).optional(),
  uiHints: z.record(z.string(), uiHintSchema).optional(),
});

export type ValidatedManifest = z.infer<typeof pluginManifestSchema>;

/**
 * Validate a plugin manifest object. Returns the validated manifest or throws.
 */
export function validateManifest(raw: unknown): PluginManifest {
  return pluginManifestSchema.parse(raw) as PluginManifest;
}

/**
 * Safe validation — returns result instead of throwing.
 */
export function safeValidateManifest(raw: unknown): {
  success: boolean;
  data?: PluginManifest;
  error?: string;
} {
  const result = pluginManifestSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data as PluginManifest };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}
