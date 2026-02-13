/**
 * Slash Commands API client
 * Phase 7 — Week 21
 */

import { apiGet } from './client';
import type { SlashCommandDef } from '@chatbot/types';

/**
 * List all available slash commands for autocomplete.
 */
export async function listCommands(): Promise<SlashCommandDef[]> {
  return apiGet<SlashCommandDef[]>('/commands');
}
