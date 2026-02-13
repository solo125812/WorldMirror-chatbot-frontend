<script lang="ts">
  import {
    listPlugins,
    enablePlugin,
    disablePlugin,
    uninstallPlugin,
  } from '$lib/api/plugins.js';
  import { untrack } from 'svelte';
  import type { InstalledPlugin } from '@chatbot/types';

  let plugins = $state<InstalledPlugin[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let actionError = $state<string | null>(null);

  async function loadPlugins() {
    loading = true;
    error = null;
    try {
      plugins = await listPlugins();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load plugins';
    } finally {
      loading = false;
    }
  }

  async function togglePlugin(plugin: InstalledPlugin) {
    actionError = null;
    try {
      if (plugin.enabled) {
        await disablePlugin(plugin.id);
      } else {
        await enablePlugin(plugin.id);
      }
      await loadPlugins();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Action failed';
    }
  }

  async function removePlugin(plugin: InstalledPlugin) {
    if (!confirm(`Uninstall plugin "${plugin.name}"?`)) return;
    actionError = null;
    try {
      await uninstallPlugin(plugin.id);
      await loadPlugins();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Uninstall failed';
    }
  }

  // Load on mount
  $effect(() => {
    untrack(() => { loadPlugins(); });
  });
</script>

<div class="page">
  <div class="page-header">
    <h2>🔌 Plugins</h2>
    <p class="subtitle">Manage installed plugins and their permissions</p>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if actionError}
    <div class="alert alert-warning">{actionError}</div>
  {/if}

  {#if loading}
    <div class="loading">Loading plugins...</div>
  {:else if plugins.length === 0}
    <div class="empty-state">
      <p>No plugins installed yet.</p>
      <p class="hint">
        Plugins extend functionality with tools, lifecycle hooks, and custom endpoints.
      </p>
    </div>
  {:else}
    <div class="plugin-list">
      {#each plugins as plugin (plugin.id)}
        <div class="plugin-card" class:disabled={!plugin.enabled}>
          <div class="plugin-info">
            <div class="plugin-header">
              <h3>{plugin.name}</h3>
              <span class="version">v{plugin.version}</span>
              <span class="status-badge" class:active={plugin.enabled}>
                {plugin.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p class="description">{plugin.description}</p>
            <div class="meta">
              <span class="meta-item">ID: {plugin.id}</span>
              {#if plugin.permissions.length > 0}
                <span class="meta-item">
                  Permissions: {plugin.permissions.join(', ')}
                </span>
              {/if}
              <span class="meta-item">
                Installed: {new Date(plugin.installedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div class="plugin-actions">
            <button
              class="btn"
              class:btn-primary={!plugin.enabled}
              class:btn-secondary={plugin.enabled}
              onclick={() => togglePlugin(plugin)}
            >
              {plugin.enabled ? 'Disable' : 'Enable'}
            </button>
            <button class="btn btn-danger" onclick={() => removePlugin(plugin)}>
              Uninstall
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .page-header {
    margin-bottom: 1.5rem;
  }

  .page-header h2 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: #888;
    font-size: 0.9rem;
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .alert-error {
    background: #3a1c1c;
    border: 1px solid #6b2f2f;
    color: #ff8888;
  }

  .alert-warning {
    background: #3a2e1c;
    border: 1px solid #6b5a2f;
    color: #ffcc88;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #888;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #888;
    background: #1a1a2e;
    border-radius: 8px;
    border: 1px dashed #2a2a3e;
  }

  .empty-state .hint {
    font-size: 0.85rem;
    color: #666;
    margin-top: 0.5rem;
  }

  .plugin-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .plugin-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem;
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 8px;
    transition: border-color 0.2s;
  }

  .plugin-card:hover {
    border-color: #3a3a5e;
  }

  .plugin-card.disabled {
    opacity: 0.7;
  }

  .plugin-info {
    flex: 1;
    min-width: 0;
  }

  .plugin-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .plugin-header h3 {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .version {
    color: #666;
    font-size: 0.85rem;
    font-family: monospace;
  }

  .status-badge {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #2a2a3e;
    color: #888;
  }

  .status-badge.active {
    background: #1a3a1a;
    color: #88ff88;
  }

  .description {
    color: #aaa;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  .meta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .meta-item {
    font-size: 0.8rem;
    color: #666;
  }

  .plugin-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: 1rem;
    flex-shrink: 0;
  }

  .btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid #3a3a5e;
    border-radius: 4px;
    background: #2a2a3e;
    color: #ccc;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s, color 0.2s;
  }

  .btn:hover {
    background: #3a3a5e;
    color: #fff;
  }

  .btn-primary {
    background: #2a3a5e;
    border-color: #3a5a8e;
    color: #88bbff;
  }

  .btn-primary:hover {
    background: #3a5a8e;
    color: #fff;
  }

  .btn-secondary {
    background: #2a2a3e;
    border-color: #3a3a5e;
  }

  .btn-danger {
    background: #3a1c1c;
    border-color: #6b2f2f;
    color: #ff8888;
  }

  .btn-danger:hover {
    background: #5a2a2a;
    color: #ffaaaa;
  }
</style>
