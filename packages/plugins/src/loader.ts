/**
 * Plugin loader — §11.9 Server Plugin Loader
 *
 * Loads plugins from the filesystem, validates manifests,
 * registers them, and manages their lifecycle.
 */

import type { PluginManifest, InstalledPlugin, ToolDefinition, ToolInfo, PluginHookEvent } from '@chatbot/types';
import type { PluginRepo } from '@chatbot/db';
import { validateManifest, safeValidateManifest } from './manifest.js';
import { HookDispatcher, type HookHandler } from './hooks.js';
import { logger } from '@chatbot/utils';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

/** Tool registry entry (includes the run function) */
interface RegisteredTool {
  definition: ToolDefinition;
  pluginId: string;
}

/**
 * PluginLoader manages the lifecycle of server-side plugins.
 *
 * Responsibilities:
 * - Scan plugin directories for manifests
 * - Validate and register plugins
 * - Manage tool registrations
 * - Dispatch lifecycle hooks
 */
export class PluginLoader {
  private tools: Map<string, RegisteredTool> = new Map();
  private hookDispatcher: HookDispatcher;
  private pluginDirs: string[];

  constructor(
    private pluginRepo: PluginRepo,
    hookDispatcher?: HookDispatcher,
    pluginDirs?: string[],
  ) {
    this.hookDispatcher = hookDispatcher ?? new HookDispatcher();
    this.pluginDirs = pluginDirs ?? [];
  }

  /**
   * Scan configured plugin directories for plugin manifests.
   * Returns discovered manifests (does not install them).
   */
  scanDirectories(): PluginManifest[] {
    const discovered: PluginManifest[] = [];

    for (const dir of this.pluginDirs) {
      if (!existsSync(dir)) continue;

      try {
        // Each subdirectory is a potential plugin
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const manifestPath = join(dir, entry.name, 'plugin.json');
          if (!existsSync(manifestPath)) continue;

          try {
            const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
            const result = safeValidateManifest(raw);
            if (result.success && result.data) {
              discovered.push(result.data);
            } else {
              logger.warn(`Invalid plugin manifest at ${manifestPath}: ${result.error}`);
            }
          } catch (e) {
            logger.warn(`Failed to read plugin manifest at ${manifestPath}`, {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      } catch (e) {
        logger.warn(`Failed to scan plugin directory ${dir}`, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return discovered;
  }

  /**
   * Install a plugin from its manifest.
   */
  install(manifest: PluginManifest): InstalledPlugin {
    // Validate manifest
    const validated = validateManifest(manifest);

    // Check if already installed
    const existing = this.pluginRepo.get(validated.id);
    if (existing) {
      throw new Error(`Plugin '${validated.id}' is already installed`);
    }

    return this.pluginRepo.create({
      id: validated.id,
      name: validated.name,
      version: validated.version,
      description: validated.description,
      entry: validated.entry,
      permissions: validated.permissions,
      configSchema: validated.configSchema ?? null,
    });
  }

  /**
   * Uninstall a plugin — removes hooks, tools, and DB record.
   */
  uninstall(pluginId: string): boolean {
    this.hookDispatcher.unregister(pluginId);
    this.unregisterTools(pluginId);
    return this.pluginRepo.delete(pluginId);
  }

  /**
   * Enable or disable a plugin.
   */
  setEnabled(pluginId: string, enabled: boolean): InstalledPlugin | null {
    const plugin = this.pluginRepo.update(pluginId, { enabled });
    if (!plugin) return null;

    if (!enabled) {
      // Unregister hooks and tools when disabled
      this.hookDispatcher.unregister(pluginId);
      this.unregisterTools(pluginId);
    }

    return plugin;
  }

  /**
   * Register a tool provided by a plugin.
   */
  registerTool(pluginId: string, tool: ToolDefinition): void {
    const key = `${pluginId}:${tool.name}`;
    this.tools.set(key, { definition: tool, pluginId });
    logger.debug(`Tool registered: ${tool.name} by ${pluginId}`);
  }

  /**
   * Unregister all tools from a specific plugin.
   */
  private unregisterTools(pluginId: string): void {
    for (const [key, entry] of this.tools.entries()) {
      if (entry.pluginId === pluginId) {
        this.tools.delete(key);
      }
    }
  }

  /**
   * Get all registered tools as serializable info objects.
   */
  getRegisteredTools(): ToolInfo[] {
    return Array.from(this.tools.values()).map((entry) => ({
      name: entry.definition.name,
      description: entry.definition.description,
      inputSchema: entry.definition.inputSchema,
      pluginId: entry.pluginId,
    }));
  }

  /**
   * Execute a registered tool by name.
   */
  async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    // Find tool by name (without plugin prefix)
    for (const [, entry] of this.tools.entries()) {
      if (entry.definition.name === name) {
        return entry.definition.run(input);
      }
    }
    throw new Error(`Tool '${name}' not found`);
  }

  /**
   * Register a lifecycle hook for a plugin.
   */
  registerHook(pluginId: string, event: PluginHookEvent, handler: HookHandler, priority?: number): void {
    this.hookDispatcher.register(pluginId, event, handler, priority);
  }

  /**
   * Dispatch a lifecycle event to all registered handlers.
   */
  async dispatchHook(event: PluginHookEvent, context: Record<string, unknown> = {}): Promise<void> {
    return this.hookDispatcher.dispatch(event, context);
  }

  /**
   * Get the hook dispatcher (for direct access).
   */
  getHookDispatcher(): HookDispatcher {
    return this.hookDispatcher;
  }
}
