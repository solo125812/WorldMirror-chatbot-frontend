/**
 * Extension manifest validation — §12.3
 */

import { z } from 'zod';
import type { ExtensionManifest } from '@chatbot/types';

export const extensionManifestSchema = z.object({
  display_name: z.string().min(1),
  version: z.string().default('0.0.0'),
  description: z.string().default(''),
  author: z.string().default(''),
  requires: z.array(z.string()).default([]),
  optional: z.array(z.string()).default([]),
  js: z.string().optional(),
  css: z.string().optional(),
});

/**
 * Validate an extension manifest.json.
 */
export function validateExtensionManifest(raw: unknown): ExtensionManifest {
  return extensionManifestSchema.parse(raw) as ExtensionManifest;
}

/**
 * Safe validation that returns result instead of throwing.
 */
export function safeValidateExtensionManifest(raw: unknown): {
  success: boolean;
  data?: ExtensionManifest;
  error?: string;
} {
  const result = extensionManifestSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data as ExtensionManifest };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}
