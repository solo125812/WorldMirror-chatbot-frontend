/**
 * Plugin API Client — communicates with /plugins server endpoints
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client.js';
import type { InstalledPlugin, PluginManifest, PluginPermission } from '@chatbot/types';

/** List all installed plugins */
export async function listPlugins(): Promise<InstalledPlugin[]> {
  const result = await apiGet<{ items: InstalledPlugin[]; total: number }>('/plugins');
  return result.items;
}

/** Get plugin details including granted permissions */
export async function getPlugin(id: string): Promise<InstalledPlugin & { grantedPermissions: string[] }> {
  return apiGet(`/plugins/${encodeURIComponent(id)}`);
}

/** Install a plugin from a manifest */
export async function installPlugin(manifest: PluginManifest): Promise<InstalledPlugin> {
  return apiPost<InstalledPlugin>('/plugins/install', { manifest });
}

/** Enable a plugin */
export async function enablePlugin(id: string): Promise<InstalledPlugin> {
  return apiPost<InstalledPlugin>(`/plugins/${encodeURIComponent(id)}/enable`, {});
}

/** Disable a plugin */
export async function disablePlugin(id: string): Promise<InstalledPlugin> {
  return apiPost<InstalledPlugin>(`/plugins/${encodeURIComponent(id)}/disable`, {});
}

/** Update plugin configuration */
export async function updatePluginConfig(
  id: string,
  config: Record<string, unknown>
): Promise<InstalledPlugin> {
  return apiPatch<InstalledPlugin>(`/plugins/${encodeURIComponent(id)}`, config);
}

/** Uninstall a plugin */
export async function uninstallPlugin(id: string): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/plugins/${encodeURIComponent(id)}`);
}

/** Grant a permission to a plugin */
export async function grantPermission(
  id: string,
  permission: PluginPermission
): Promise<{ permissions: string[] }> {
  return apiPost(`/plugins/${encodeURIComponent(id)}/permissions`, { permission });
}

/** Revoke a permission from a plugin */
export async function revokePermission(
  id: string,
  permission: PluginPermission
): Promise<{ permissions: string[] }> {
  return apiDelete(`/plugins/${encodeURIComponent(id)}/permissions/${encodeURIComponent(permission)}`);
}

/** List all registered tools across plugins */
export async function listPluginTools(): Promise<{ tools: unknown[] }> {
  return apiGet('/plugins/tools');
}
