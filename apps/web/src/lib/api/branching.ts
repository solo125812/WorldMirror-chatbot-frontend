/**
 * Branching API client
 * Phase 7 — Week 22
 */

import { apiGet, apiPost, apiDelete } from './client';
import type {
  ChatBranch,
  ChatCheckpoint,
  CreateBranchPayload,
  CreateCheckpointPayload,
} from '@chatbot/types';

// ─── Branches ────────────────────────────────────────────────────

export async function createBranch(
  chatId: string,
  payload: Omit<CreateBranchPayload, 'chatId'>,
): Promise<ChatBranch> {
  return apiPost<ChatBranch>(`/chats/${encodeURIComponent(chatId)}/branches`, payload);
}

export async function listBranches(chatId: string): Promise<ChatBranch[]> {
  return apiGet<ChatBranch[]>(`/chats/${encodeURIComponent(chatId)}/branches`);
}

// ─── Checkpoints ─────────────────────────────────────────────────

export async function createCheckpoint(
  chatId: string,
  payload: Omit<CreateCheckpointPayload, 'chatId'>,
): Promise<ChatCheckpoint> {
  return apiPost<ChatCheckpoint>(
    `/chats/${encodeURIComponent(chatId)}/checkpoints`,
    payload,
  );
}

export async function listCheckpoints(chatId: string): Promise<ChatCheckpoint[]> {
  return apiGet<ChatCheckpoint[]>(
    `/chats/${encodeURIComponent(chatId)}/checkpoints`,
  );
}

export async function restoreCheckpoint(
  chatId: string,
  checkpointId: string,
): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(
    `/chats/${encodeURIComponent(chatId)}/checkpoints/${encodeURIComponent(checkpointId)}/restore`,
    {},
  );
}

export async function deleteCheckpoint(
  chatId: string,
  checkpointId: string,
): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>(
    `/chats/${encodeURIComponent(chatId)}/checkpoints/${encodeURIComponent(checkpointId)}`,
  );
}
