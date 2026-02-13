/**
 * Indexer API Client — communicates with /indexer server endpoints
 */

import { apiGet, apiPost } from './client.js';
import type { IndexStatus, IndexJob, CodeSearchResult } from '@chatbot/types';

/** Get current indexing status */
export async function getIndexerStatus(): Promise<IndexStatus> {
  return apiGet<IndexStatus>('/indexer/status');
}

/** Start an indexing job */
export async function startIndexing(payload: {
  workspacePath: string;
  mode?: 'full' | 'incremental';
  ignorePatterns?: string[];
}): Promise<IndexJob> {
  return apiPost<IndexJob>('/indexer/scan', payload);
}

/** Stop the current indexing job */
export async function stopIndexing(): Promise<{ stopped: boolean }> {
  return apiPost<{ stopped: boolean }>('/indexer/stop', {});
}

/** Search indexed code */
export async function searchCode(query: string, opts?: {
  workspacePath?: string;
  language?: string;
  topK?: number;
}): Promise<{ results: CodeSearchResult[] }> {
  const params = new URLSearchParams({ query });
  if (opts?.workspacePath) params.set('workspacePath', opts.workspacePath);
  if (opts?.language) params.set('language', opts.language);
  if (opts?.topK) params.set('topK', String(opts.topK));
  return apiGet<{ results: CodeSearchResult[] }>(`/indexer/search?${params.toString()}`);
}

/** List indexing jobs */
export async function listIndexJobs(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<IndexJob[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  const result = await apiGet<{ items: IndexJob[]; total: number }>(`/indexer/jobs${qs ? `?${qs}` : ''}`);
  return result.items;
}

/** Get a specific indexing job */
export async function getIndexJob(id: string): Promise<IndexJob> {
  return apiGet<IndexJob>(`/indexer/jobs/${encodeURIComponent(id)}`);
}
