<script lang="ts">
  import { onMount } from 'svelte';
  import { apiGet } from '$lib/api/client';

  let config = $state<Record<string, unknown> | null>(null);
  let models = $state<Array<{id: string; name: string; providerId: string}>>([]);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      config = await apiGet('/config');
      const modelsResult = await apiGet<{models: typeof models}>('/models');
      models = modelsResult.models;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load settings';
    }
  });
</script>

<div class="settings-container">
  <h2>⚙️ Settings</h2>

  {#if error}
    <div class="error-panel">
      ⚠️ {error}
    </div>
  {/if}

  <section>
    <h3>Server Status</h3>
    {#if config}
      <p class="status-ok">✅ Connected</p>
    {:else}
      <p class="status-error">❌ Not connected. Make sure the server is running on port 3001.</p>
    {/if}
  </section>

  <section>
    <h3>Available Models</h3>
    {#if models.length > 0}
      <ul class="model-list">
        {#each models as model (model.id)}
          <li>
            <strong>{model.name}</strong>
            <span class="model-provider">({model.providerId})</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">No models available. Check your provider configuration.</p>
    {/if}
  </section>

  <section>
    <h3>Configuration</h3>
    {#if config}
      <pre class="config-json">{JSON.stringify(config, null, 2)}</pre>
    {:else}
      <p class="muted">Loading...</p>
    {/if}
  </section>
</div>

<style>
  .settings-container {
    max-width: 700px;
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

  section {
    margin-bottom: 2rem;
    padding: 1rem;
    background: #1a1a2e;
    border-radius: 8px;
    border: 1px solid #2a2a3e;
  }

  .status-ok {
    color: #88cc88;
  }

  .status-error {
    color: #cc8888;
  }

  .error-panel {
    padding: 0.5rem 1rem;
    background: #3a1a1a;
    color: #ff8888;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .model-list {
    list-style: none;
    padding: 0;
  }

  .model-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #2a2a3e;
  }

  .model-list li:last-child {
    border-bottom: none;
  }

  .model-provider {
    color: #888;
    font-size: 0.85rem;
    margin-left: 0.5rem;
  }

  .muted {
    color: #666;
  }

  .config-json {
    background: #0f0f1f;
    padding: 1rem;
    border-radius: 4px;
    font-size: 0.85rem;
    overflow-x: auto;
    color: #aab;
  }
</style>
