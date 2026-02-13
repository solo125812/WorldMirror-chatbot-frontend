/**
 * Plugin permission model — §11.5
 *
 * Evaluates whether a plugin is allowed to perform an action
 * based on its declared permissions and user-granted approvals.
 */

import type { PluginPermission, InstalledPlugin } from '@chatbot/types';
import type { PluginRepo } from '@chatbot/db';

/** All known permission scopes */
export const ALL_PERMISSIONS: readonly PluginPermission[] = [
  'network',
  'filesystem:read',
  'filesystem:write',
  'memory:read',
  'memory:write',
  'tools:register',
  'dom:access',
  'settings:read',
  'settings:write',
] as const;

/** Permission descriptions for UI display */
export const PERMISSION_LABELS: Record<PluginPermission, string> = {
  'network': 'Make HTTP requests',
  'filesystem:read': 'Read files',
  'filesystem:write': 'Write files',
  'memory:read': 'Read memory entries',
  'memory:write': 'Write memory entries',
  'tools:register': 'Register LLM tools',
  'dom:access': 'Access DOM (UI plugins)',
  'settings:read': 'Read app settings',
  'settings:write': 'Modify app settings',
};

/**
 * Check if a plugin has a specific permission granted.
 */
export function hasPermission(
  plugin: InstalledPlugin,
  permission: PluginPermission,
  grants: Array<{ permission: PluginPermission; granted: boolean }>,
): boolean {
  // Plugin must declare the permission in its manifest
  if (!plugin.permissions.includes(permission)) {
    return false;
  }

  // Permission must be explicitly granted by the user
  const grant = grants.find((g) => g.permission === permission);
  return grant?.granted === true;
}

/**
 * Get the list of permissions the plugin requests but hasn't been granted.
 */
export function getPendingPermissions(
  plugin: InstalledPlugin,
  grants: Array<{ permission: PluginPermission; granted: boolean }>,
): PluginPermission[] {
  return plugin.permissions.filter((p) => {
    const grant = grants.find((g) => g.permission === p);
    return !grant || !grant.granted;
  });
}

/**
 * Validate that all requested permissions are known.
 */
export function validatePermissions(permissions: string[]): {
  valid: boolean;
  unknown: string[];
} {
  const known = new Set<string>(ALL_PERMISSIONS);
  const unknown = permissions.filter((p) => !known.has(p));
  return {
    valid: unknown.length === 0,
    unknown,
  };
}
