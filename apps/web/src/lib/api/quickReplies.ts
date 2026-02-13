/**
 * Quick Replies API client
 * Phase 7 — Week 22
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type {
  QuickReplySet,
  QuickReplyItem,
  CreateQuickReplySetPayload,
  CreateQuickReplyItemPayload,
} from '@chatbot/types';

// ─── Quick Reply Sets ────────────────────────────────────────────

export async function listQuickReplySets(): Promise<QuickReplySet[]> {
  return apiGet<QuickReplySet[]>('/quick-replies/sets');
}

export async function getQuickReplySet(id: string): Promise<QuickReplySet> {
  return apiGet<QuickReplySet>(`/quick-replies/sets/${encodeURIComponent(id)}`);
}

export async function createQuickReplySet(
  payload: CreateQuickReplySetPayload,
): Promise<QuickReplySet> {
  return apiPost<QuickReplySet>('/quick-replies/sets', payload);
}

export async function updateQuickReplySet(
  id: string,
  payload: Partial<CreateQuickReplySetPayload>,
): Promise<QuickReplySet> {
  return apiPatch<QuickReplySet>(
    `/quick-replies/sets/${encodeURIComponent(id)}`,
    payload,
  );
}

export async function deleteQuickReplySet(
  id: string,
): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>(
    `/quick-replies/sets/${encodeURIComponent(id)}`,
  );
}

// ─── Quick Reply Items ───────────────────────────────────────────

export async function createQuickReplyItem(
  payload: CreateQuickReplyItemPayload,
): Promise<QuickReplyItem> {
  return apiPost<QuickReplyItem>('/quick-replies/items', payload);
}

export async function updateQuickReplyItem(
  id: string,
  payload: Partial<Omit<CreateQuickReplyItemPayload, 'setId'>>,
): Promise<QuickReplyItem> {
  return apiPatch<QuickReplyItem>(
    `/quick-replies/items/${encodeURIComponent(id)}`,
    payload,
  );
}

export async function deleteQuickReplyItem(
  id: string,
): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>(
    `/quick-replies/items/${encodeURIComponent(id)}`,
  );
}

export async function reorderQuickReplyItems(
  items: Array<{ id: string; sortOrder: number }>,
): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>('/quick-replies/items/reorder', { items });
}
