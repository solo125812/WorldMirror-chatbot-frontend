<script lang="ts">
  import {
    listExtensions,
    installExtension,
    updateExtension,
    uninstallExtension,
    setExtensionEnabled,
    checkExtensionUpdates,
  } from '$lib/api/extensions.js';
  import { untrack } from 'svelte';
  import type { InstalledExtension, UpdateCheckResult } from '@chatbot/types';

  let extensions = $state<InstalledExtension[]>([]);
  let updates = $state<UpdateCheckResult[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let checkingUpdates = $state(false);

  // Install form
  let showInstallForm = $state(false);
  let installUrl = $state('');
  let installBranch = $state('');
  let installSource = $state<'git' | 'archive'>('git');
  let installing = $state(false);

  async function loadExtensions() {
    loading = true;
    error = null;
    try {
      extensions = await listExtensions();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load extensions';
    } finally {
      loading = false;
    }
  }

  async function handleInstall() {
    if (!installUrl.trim()) return;
    installing = true;
    actionError = null;
    try {
      await installExtension({
        url: installUrl.trim(),
        branch: installBranch.trim() || undefined,
        source: installSource,
      });
      installUrl = '';
      installBranch = '';
      showInstallForm = false;
      await loadExtensions();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Install failed';
    } finally {
      installing = false;
    }
  }

  async function handleUpdate(ext: InstalledExtension) {
    actionError = null;
    try {
      await updateExtension(ext.name);
      await loadExtensions();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Update failed';
    }
  }

  async function handleToggle(ext: InstalledExtension) {
    actionError = null;
    try {
      await setExtensionEnabled(ext.name, !ext.enabled);
      await loadExtensions();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Toggle failed';
    }
  }

  async function handleUninstall(ext: InstalledExtension) {
    if (!confirm(`Uninstall extension "${ext.displayName}"?`)) return;
    actionError = null;
    try {
      await uninstallExtension(ext.name);
      await loadExtensions();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Uninstall failed';
    }
  }

  async function handleCheckUpdates() {
    checkingUpdates = true;
    actionError = null;
    try {
      const result = await checkExtensionUpdates();
      updates = result.updates;
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Update check failed';
    } finally {
      checkingUpdates = false;
    }
  }

  function hasUpdate(name: string): boolean {
    return updates.some((u) => u.name === name && u.hasUpdate);
  }

  $effect(() => {
    untrack(() => { loadExtensions(); });
  });
</script>

<div class="page">
  <div class="page-header">
    <div class="header-row">
      <div>
        <h2>🧩 Extensions</h2>
        <p class="subtitle">Install and manage UI extensions</p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-secondary"
          onclick={handleCheckUpdates}
          disabled={checkingUpdates}
        >
          {checkingUpdates ? 'Checking...' : '🔄 Check Updates'}
        </button>
        <button
          class="btn btn-primary"
          onclick={() => (showInstallForm = !showInstallForm)}
        >
          {showInstallForm ? 'Cancel' : '+ Install Extension'}
        </button>
      </div>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if actionError}
    <div class="alert alert-warning">{actionError}</div>
  {/if}

  {#if showInstallForm}
    <div class="install-form">
      <h3>Install Extension</h3>
      <div class="form-group">
        <label for="install-url">Repository URL or Archive URL</label>
        <input
          id="install-url"
          type="text"
          bind:value={installUrl}
          placeholder="https://github.com/user/extension.git"
          class="input"
        />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="install-branch">Branch (optional)</label>
          <input
            id="install-branch"
            type="text"
            bind:value={installBranch}
            placeholder="main"
            class="input"
          />
        </div>
        <div class="form-group">
          <label for="install-source">Source</label>
          <select id="install-source" bind:value={installSource} class="input">
            <option value="git">Git</option>
            <option value="archive">Archive (ZIP)</option>
          </select>
        </div>
      </div>
      <button
        class="btn btn-primary"
        onclick={handleInstall}
        disabled={installing || !installUrl.trim()}
      >
        {installing ? 'Installing...' : 'Install'}
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading extensions...</div>
  {:else if extensions.length === 0}
    <div class="empty-state">
      <p>No extensions installed yet.</p>
      <p class="hint">
        Extensions add UI components, styles, and functionality to the chat interface.
      </p>
    </div>
  {:else}
    <div class="ext-list">
      {#each extensions as ext (ext.id)}
        <div class="ext-card" class:disabled={!ext.enabled}>
          <div class="ext-info">
            <div class="ext-header">
              <h3>{ext.displayName}</h3>
              <span class="version">v{ext.version}</span>
              <span class="source-badge">{ext.source}</span>
              <span class="status-badge" class:active={ext.enabled}>
                {ext.enabled ? 'Active' : 'Disabled'}
              </span>
              {#if hasUpdate(ext.name)}
                <span class="update-badge">Update Available</span>
              {/if}
            </div>
            <p class="description">{ext.description}</p>
            <div class="meta">
              <span class="meta-item">by {ext.author}</span>
              {#if ext.branch}
                <span class="meta-item">Branch: {ext.branch}</span>
              {/if}
              {#if ext.commit}
                <span class="meta-item">Commit: {ext.commit.substring(0, 7)}</span>
              {/if}
              <span class="meta-item">Scope: {ext.scope}</span>
            </div>
          </div>
          <div class="ext-actions">
            <button
              class="btn"
              class:btn-primary={!ext.enabled}
              class:btn-secondary={ext.enabled}
              onclick={() => handleToggle(ext)}
            >
              {ext.enabled ? 'Disable' : 'Enable'}
            </button>
            {#if ext.source === 'git' && hasUpdate(ext.name)}
              <button class="btn btn-primary" onclick={() => handleUpdate(ext)}>
                Update
              </button>
            {/if}
            <button class="btn btn-danger" onclick={() => handleUninstall(ext)}>
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

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .page-header h2 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: #888;
    font-size: 0.9rem;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
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

  .install-form {
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .install-form h3 {
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .form-group {
    margin-bottom: 0.75rem;
  }

  .form-group label {
    display: block;
    font-size: 0.85rem;
    color: #aaa;
    margin-bottom: 0.25rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .form-row .form-group {
    flex: 1;
  }

  .input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: #0f0f1a;
    border: 1px solid #2a2a3e;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 0.9rem;
  }

  .input:focus {
    outline: none;
    border-color: #4a4a7e;
  }

  .ext-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ext-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem;
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 8px;
    transition: border-color 0.2s;
  }

  .ext-card:hover {
    border-color: #3a3a5e;
  }

  .ext-card.disabled {
    opacity: 0.7;
  }

  .ext-info {
    flex: 1;
    min-width: 0;
  }

  .ext-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .ext-header h3 {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .version {
    color: #666;
    font-size: 0.85rem;
    font-family: monospace;
  }

  .source-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    background: #2a2a3e;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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

  .update-badge {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #3a3a1a;
    color: #ffcc44;
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

  .ext-actions {
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

  .btn:hover:not(:disabled) {
    background: #3a3a5e;
    color: #fff;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #2a3a5e;
    border-color: #3a5a8e;
    color: #88bbff;
  }

  .btn-primary:hover:not(:disabled) {
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

  .btn-danger:hover:not(:disabled) {
    background: #5a2a2a;
    color: #ffaaaa;
  }
</style>
