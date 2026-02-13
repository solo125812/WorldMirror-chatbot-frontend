<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listQuickReplySets,
    createQuickReplySet,
    deleteQuickReplySet,
    createQuickReplyItem,
    deleteQuickReplyItem,
  } from '$lib/api/quickReplies';
  import type { QuickReplySet } from '@chatbot/types';

  let sets = $state<QuickReplySet[]>([]);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let newSetName = $state('');
  let expandedSetId = $state<string | null>(null);
  let newItemLabel = $state('');
  let newItemContent = $state('');

  onMount(async () => {
    await loadSets();
  });

  async function loadSets() {
    loading = true;
    try {
      sets = await listQuickReplySets();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load quick reply sets';
    } finally {
      loading = false;
    }
  }

  async function handleCreateSet() {
    if (!newSetName.trim()) return;
    try {
      await createQuickReplySet({ name: newSetName.trim(), enabled: true });
      newSetName = '';
      await loadSets();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create set';
    }
  }

  async function handleDeleteSet(id: string) {
    try {
      await deleteQuickReplySet(id);
      if (expandedSetId === id) expandedSetId = null;
      await loadSets();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete set';
    }
  }

  async function handleAddItem(setId: string) {
    if (!newItemLabel.trim() || !newItemContent.trim()) return;
    try {
      await createQuickReplyItem({
        setId,
        label: newItemLabel.trim(),
        content: newItemContent.trim(),
        sortOrder: 0,
      });
      newItemLabel = '';
      newItemContent = '';
      await loadSets();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to add item';
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteQuickReplyItem(itemId);
      await loadSets();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete item';
    }
  }

  function toggleExpand(setId: string) {
    expandedSetId = expandedSetId === setId ? null : setId;
  }
</script>

<div class="qr-container">
  <h2>⚡ Quick Replies</h2>

  {#if error}
    <div class="error-panel">⚠️ {error}
      <button class="dismiss-btn" onclick={() => error = null}>✕</button>
    </div>
  {/if}

  <!-- Create New Set -->
  <section class="create-section">
    <h3>Create New Set</h3>
    <div class="create-row">
      <input
        type="text"
        placeholder="Set name..."
        bind:value={newSetName}
        onkeydown={(e) => e.key === 'Enter' && handleCreateSet()}
      />
      <button onclick={handleCreateSet}>Create</button>
    </div>
  </section>

  <!-- Sets List -->
  {#if loading}
    <p class="muted">Loading quick reply sets...</p>
  {:else if sets.length === 0}
    <div class="empty-state">
      <p>No quick reply sets yet.</p>
      <p class="muted">Create a set above to get started.</p>
    </div>
  {:else}
    <div class="sets-list">
      {#each sets as qset (qset.id)}
        <div class="set-card" class:expanded={expandedSetId === qset.id}>
          <div class="set-header" onclick={() => toggleExpand(qset.id)}>
            <span class="set-icon">{expandedSetId === qset.id ? '▼' : '▶'}</span>
            <strong>{qset.name}</strong>
            <span class="set-meta">
              {#if qset.characterId}
                🧑 Character-specific
              {:else}
                🌐 Global
              {/if}
              {#if !qset.enabled}
                <span class="disabled-badge">disabled</span>
              {/if}
            </span>
            <button
              class="delete-btn"
              onclick={(e) => { e.stopPropagation(); handleDeleteSet(qset.id); }}
              title="Delete set"
            >🗑️</button>
          </div>

          {#if expandedSetId === qset.id}
            <div class="set-body">
              <!-- Items -->
              {#if qset.items && qset.items.length > 0}
                <div class="items-list">
                  {#each qset.items as item (item.id)}
                    <div class="item-row">
                      <span class="item-label">{item.label}</span>
                      <span class="item-content">{item.content}</span>
                      <button
                        class="delete-btn small"
                        onclick={() => handleDeleteItem(item.id)}
                        title="Remove item"
                      >✕</button>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="muted">No items in this set.</p>
              {/if}

              <!-- Add Item -->
              <div class="add-item-form">
                <input
                  type="text"
                  placeholder="Label (button text)"
                  bind:value={newItemLabel}
                />
                <input
                  type="text"
                  placeholder="Content (message to send)"
                  bind:value={newItemContent}
                  onkeydown={(e) => e.key === 'Enter' && handleAddItem(qset.id)}
                />
                <button onclick={() => handleAddItem(qset.id)}>Add</button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .qr-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  h2 {
    margin-bottom: 1.5rem;
  }

  h3 {
    margin-bottom: 0.5rem;
    color: #9090c0;
  }

  .error-panel {
    padding: 1rem;
    background: #3a1a1a;
    color: #ff8888;
    border-radius: 6px;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dismiss-btn {
    background: transparent;
    border: none;
    color: #ff8888;
    cursor: pointer;
    font-size: 1rem;
  }

  .muted {
    color: #888;
    font-style: italic;
  }

  .create-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #1e1e2e;
    border-radius: 8px;
  }

  .create-row {
    display: flex;
    gap: 0.5rem;
  }

  .create-row input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: #2a2a3e;
    color: #ddd;
    border: 1px solid #444;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    background: #1e1e2e;
    border-radius: 8px;
  }

  .sets-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .set-card {
    background: #1e1e2e;
    border-radius: 8px;
    overflow: hidden;
  }

  .set-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    user-select: none;
  }

  .set-header:hover {
    background: #252540;
  }

  .set-icon {
    font-size: 0.75rem;
    color: #888;
    width: 1rem;
  }

  .set-meta {
    margin-left: auto;
    font-size: 0.8rem;
    color: #888;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .disabled-badge {
    background: #3a2a20;
    color: #d09060;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.7rem;
  }

  .set-body {
    padding: 0 1rem 1rem;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-bottom: 0.75rem;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: #252540;
    border-radius: 4px;
  }

  .item-label {
    font-weight: bold;
    color: #a0a0ff;
    min-width: 80px;
    font-size: 0.85rem;
  }

  .item-content {
    flex: 1;
    font-size: 0.85rem;
    color: #bbb;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .add-item-form {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .add-item-form input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    background: #2a2a3e;
    color: #ddd;
    border: 1px solid #444;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .delete-btn {
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
  }

  .delete-btn:hover {
    background: #3a1a1a;
    color: #ff6666;
  }

  .delete-btn.small {
    font-size: 0.75rem;
  }

  button {
    padding: 0.5rem 1rem;
    background: #4a4a8a;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  button:hover {
    background: #5a5a9a;
  }
</style>
