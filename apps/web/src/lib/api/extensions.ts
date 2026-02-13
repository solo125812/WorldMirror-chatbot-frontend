/**
 * Extension API Client — communicates with /extensions server endpoints
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client.js';
import type { InstalledExtension, UpdateCheckResult } from '@chatbot/types';

/** List installed extensions */
export async function listExtensions(opts?: {
  scope?: string;
  limit?: number;
  offset?: number;
}): Promise<InstalledExtension[]> {
  const params = new URLSearchParams();
  if (opts?.scope) params.set('scope', opts.scope);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  const result = await apiGet<{ items: InstalledExtension[]; total: number }>(`/extensions${qs ? `?${qs}` : ''}`);
  return result.items;
}

/** Get extension details */
export async function getExtension(name: string): Promise<InstalledExtension> {
  return apiGet<InstalledExtension>(`/extensions/${encodeURIComponent(name)}`);
}

/** Install an extension */
export async function installExtension(payload: {
  url: string;
  branch?: string;
  scope?: string;
  source?: 'git' | 'archive';
}): Promise<InstalledExtension> {
  return apiPost<InstalledExtension>('/extensions/install', payload);
}

/** Update an extension */
export async function updateExtension(name: string): Promise<InstalledExtension> {
  return apiPost<InstalledExtension>('/extensions/update', { name });
}

/** Uninstall an extension */
export async function uninstallExtension(name: string): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/extensions/${encodeURIComponent(name)}`);
}

/** Enable or disable an extension */
export async function setExtensionEnabled(
  name: string,
  enabled: boolean
): Promise<InstalledExtension> {
  return apiPatch<InstalledExtension>(`/extensions/${encodeURIComponent(name)}`, { enabled });
}

/** List branches for an extension */
export async function listExtensionBranches(
  name: string
): Promise<{ branches: string[] }> {
  return apiPost<{ branches: string[] }>('/extensions/branches', { name });
}

/** Check for updates across all extensions */
export async function checkExtensionUpdates(): Promise<{
  updates: UpdateCheckResult[];
}> {
  return apiPost<{ updates: UpdateCheckResult[] }>('/extensions/check-updates', {});
}
