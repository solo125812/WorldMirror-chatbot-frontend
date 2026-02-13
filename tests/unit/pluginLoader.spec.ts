/**
 * Unit tests for PluginLoader tool registration lifecycle
 */

import { describe, it, expect } from 'vitest';
import { PluginLoader } from '@chatbot/plugins';
import type { PluginRepo } from '@chatbot/db';
import type { InstalledPlugin, ToolDefinition } from '@chatbot/types';

function createPluginRepoStub(initial: InstalledPlugin[]): PluginRepo {
  const store = new Map<string, InstalledPlugin>(initial.map((p) => [p.id, p]));

  return {
    get(id: string) {
      return store.get(id) ?? null;
    },
    create(data: any) {
      const plugin: InstalledPlugin = {
        enabled: false,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pluginConfig: null,
        configSchema: null,
        permissions: [],
        description: '',
        ...data,
      };
      store.set(plugin.id, plugin);
      return plugin;
    },
    update(id: string, patch: any) {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      store.set(id, updated);
      return updated;
    },
    delete(id: string) {
      return store.delete(id);
    },
    list() {
      return { items: Array.from(store.values()), total: store.size };
    },
    deleteByName() {
      return false;
    },
    getByName() {
      return null;
    },
  } as unknown as PluginRepo;
}

describe('PluginLoader', () => {
  it('unregisters tools when a plugin is disabled', async () => {
    const plugin: InstalledPlugin = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: '',
      entry: 'index.ts',
      enabled: true,
      permissions: [],
      configSchema: null,
      pluginConfig: null,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const repo = createPluginRepoStub([plugin]);
    const loader = new PluginLoader(repo);

    const tool: ToolDefinition = {
      name: 'hello',
      description: 'say hello',
      inputSchema: { type: 'object', properties: {} },
      run: async () => 'ok',
    };

    loader.registerTool(plugin.id, tool);
    await expect(loader.executeTool('hello', {})).resolves.toBe('ok');

    loader.setEnabled(plugin.id, false);
    await expect(loader.executeTool('hello', {})).rejects.toThrow('not found');
  });
});
