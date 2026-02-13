/**
 * @chatbot/plugins — Plugin system
 */

export { validateManifest, safeValidateManifest, pluginManifestSchema } from './manifest.js';
export { PluginLoader } from './loader.js';
export { HookDispatcher } from './hooks.js';
export type { HookHandler } from './hooks.js';
export {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  hasPermission,
  getPendingPermissions,
  validatePermissions,
} from './permissions.js';
