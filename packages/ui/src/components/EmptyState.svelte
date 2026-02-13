<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    message,
    hint,
    children,
  }: {
    message: string;
    hint?: string;
    children?: Snippet;
  } = $props();
</script>

<div class="empty-state">
  <p>{message}</p>
  {#if hint}
    <p class="hint">{hint}</p>
  {/if}
  {#if children}
    <div class="actions">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #888;
    background: #1a1a2e;
    border-radius: 8px;
    border: 1px dashed #2a2a3e;
  }

  .hint {
    font-size: 0.85rem;
    color: #666;
    margin-top: 0.5rem;
  }

  .actions {
    margin-top: 1rem;
  }
</style>
