/**
 * Instruct Mode and Tokenizer API client
 * Phase 7 — Week 20
 */

import { apiGet, apiPost } from './client';
import type { InstructPreset, InstructTemplate, TokenizeResponse, TokenizerInfo } from '@chatbot/types';

// ─── Instruct Presets ────────────────────────────────────────────

export async function listInstructPresets(): Promise<InstructPreset[]> {
  return apiGet<InstructPreset[]>('/instruct/presets');
}

export async function getInstructPreset(id: string): Promise<InstructPreset> {
  return apiGet<InstructPreset>(`/instruct/presets/${encodeURIComponent(id)}`);
}

export async function detectInstructFormat(modelId: string): Promise<{
  presetId: string | null;
  preset: InstructPreset | null;
}> {
  return apiGet(`/instruct/detect?modelId=${encodeURIComponent(modelId)}`);
}

export async function previewInstructFormat(payload: {
  messages: Array<{ role: string; content: string }>;
  templateId: string;
  systemPrompt?: string;
}): Promise<{ formatted: string; template: InstructTemplate }> {
  return apiPost('/instruct/preview', payload);
}

// ─── Tokenizer ───────────────────────────────────────────────────

export async function tokenize(payload: {
  text: string;
  modelId?: string;
}): Promise<TokenizeResponse> {
  return apiPost<TokenizeResponse>('/tokenize', payload);
}

export async function listTokenizers(): Promise<TokenizerInfo[]> {
  return apiGet<TokenizerInfo[]>('/tokenizers');
}
