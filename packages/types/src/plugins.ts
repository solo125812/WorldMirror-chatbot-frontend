/**
 * Plugin system types — §11 Plugin System
 */

/** Plugin permission scopes */
export type PluginPermission =
  | 'network'
  | 'filesystem:read'
  | 'filesystem:write'
  | 'memory:read'
  | 'memory:write'
  | 'tools:register'
  | 'dom:access'
  | 'settings:read'
  | 'settings:write';

/** Plugin lifecycle hook event names */
export type PluginHookEvent =
  | 'before_generation'
  | 'after_generation'
  | 'message_received'
  | 'message_sending'
  | 'before_rag_query'
  | 'after_rag_query'
  | 'before_tool_call'
  | 'after_tool_call'
  | 'session_start'
  | 'session_end'
  | 'context_compaction'
  | 'app_start'
  | 'app_stop';

/** Plugin manifest as defined in plugin.json */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
  permissions: PluginPermission[];
  configSchema?: Record<string, PluginConfigField>;
  uiHints?: Record<string, PluginUIHint>;
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean';
  label: string;
  sensitive?: boolean;
  placeholder?: string;
  default?: string | number | boolean;
}

export interface PluginUIHint {
  label: string;
  sensitive?: boolean;
  help?: string;
}

/** Installed plugin record (persisted) */
export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
  enabled: boolean;
  permissions: PluginPermission[];
  configSchema: Record<string, PluginConfigField> | null;
  pluginConfig: Record<string, unknown> | null;
  installedAt: string;
  updatedAt: string;
}

/** Plugin permission grant record */
export interface PluginPermissionGrant {
  id: string;
  pluginId: string;
  permission: PluginPermission;
  granted: boolean;
  grantedAt: string;
}

/** Payload to install a plugin */
export interface InstallPluginPayload {
  manifest: PluginManifest;
  source: 'local' | 'archive' | 'git';
  path?: string;
}

/** Payload to update plugin config */
export interface UpdatePluginPayload {
  enabled?: boolean;
  pluginConfig?: Record<string, unknown>;
}

/** Tool definition registered by plugins */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (input: Record<string, unknown>) => Promise<string>;
}

/** Serializable tool info (without run function) */
export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  pluginId: string;
}
