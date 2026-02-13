<script lang="ts">
  import { onMount } from 'svelte';
  import { listInstructPresets, detectInstructFormat, previewInstructFormat, tokenize } from '$lib/api/instruct';
  import type { InstructPreset } from '@chatbot/types';

  let presets = $state<InstructPreset[]>([]);
  let selectedPresetId = $state<string | null>(null);
  let detectedPresetId = $state<string | null>(null);
  let previewText = $state('');
  let tokenCount = $state<{ count: number; tokenizerName: string; isApproximate: boolean } | null>(null);
  let tokenInput = $state('');
  let modelIdInput = $state('');
  let error = $state<string | null>(null);
  let loading = $state(true);

  const sampleMessages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there! How can I help you today?' },
    { role: 'user', content: 'Tell me a joke.' },
  ];

  onMount(async () => {
    try {
      presets = await listInstructPresets();
      if (presets.length > 0) {
        selectedPresetId = presets[0].id;
        await updatePreview();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load instruct presets';
    } finally {
      loading = false;
    }
  });

  async function updatePreview() {
    if (!selectedPresetId) return;
    try {
      const result = await previewInstructFormat({
        messages: sampleMessages,
        templateId: selectedPresetId,
      });
      previewText = result.formatted;
    } catch (e) {
      previewText = `Error: ${e instanceof Error ? e.message : 'Preview failed'}`;
    }
  }

  async function handleDetect() {
    if (!modelIdInput.trim()) return;
    try {
      const result = await detectInstructFormat(modelIdInput.trim());
      detectedPresetId = result.presetId;
      if (result.presetId) {
        selectedPresetId = result.presetId;
        await updatePreview();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Detection failed';
    }
  }

  async function handleTokenize() {
    if (!tokenInput.trim()) return;
    try {
      tokenCount = await tokenize({
        text: tokenInput.trim(),
        modelId: modelIdInput.trim() || undefined,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Tokenization failed';
    }
  }
</script>

<div class="instruct-container">
  <h2>📝 Instruct Mode & Tokenizer</h2>

  {#if error}
    <div class="error-panel">⚠️ {error}</div>
  {/if}

  {#if loading}
    <p class="muted">Loading presets...</p>
  {:else}
    <!-- Auto-Detection -->
    <section>
      <h3>🔍 Auto-Detect Format</h3>
      <div class="detect-row">
        <input
          type="text"
          placeholder="Enter model ID (e.g. llama-3.1-8b, claude-3.5-sonnet)"
          bind:value={modelIdInput}
        />
        <button onclick={handleDetect}>Detect</button>
      </div>
      {#if detectedPresetId}
        <p class="detect-result">✅ Detected: <strong>{detectedPresetId}</strong></p>
      {:else if detectedPresetId === null && modelIdInput}
        <p class="detect-result muted">No instruct format detected — model likely uses chat completions API</p>
      {/if}
    </section>

    <!-- Preset Selector -->
    <section>
      <h3>📋 Instruct Presets</h3>
      <div class="preset-selector">
        <select
          bind:value={selectedPresetId}
          onchange={updatePreview}
        >
          {#each presets as preset (preset.id)}
            <option value={preset.id}>{preset.name}</option>
          {/each}
        </select>
      </div>

      {#if selectedPresetId}
        {@const preset = presets.find(p => p.id === selectedPresetId)}
        {#if preset}
          <div class="preset-info">
            <p class="preset-desc">{preset.description}</p>
            <div class="preset-models">
              <strong>Models:</strong>
              {#each preset.modelPatterns as pattern}
                <span class="model-badge">{pattern}</span>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </section>

    <!-- Format Preview -->
    <section>
      <h3>👁️ Format Preview</h3>
      <p class="muted">Sample conversation rendered with the selected instruct template:</p>
      <pre class="format-preview">{previewText || 'Select a preset to see preview'}</pre>
    </section>

    <!-- Token Counter -->
    <section>
      <h3>🔢 Token Counter</h3>
      <div class="token-input-row">
        <textarea
          placeholder="Enter text to count tokens..."
          bind:value={tokenInput}
          rows="3"
        ></textarea>
        <button onclick={handleTokenize}>Count Tokens</button>
      </div>
      {#if tokenCount}
        <div class="token-result">
          <span class="token-count">{tokenCount.count} tokens</span>
          <span class="token-meta">
            via {tokenCount.tokenizerName}
            {#if tokenCount.isApproximate}
              <span class="approx-badge">≈ approximate</span>
            {:else}
              <span class="exact-badge">✓ exact</span>
            {/if}
          </span>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .instruct-container {
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

  section {
    margin-bottom: 2rem;
    padding: 1rem;
    background: #1e1e2e;
    border-radius: 8px;
  }

  .error-panel {
    padding: 1rem;
    background: #3a1a1a;
    color: #ff8888;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .muted {
    color: #888;
    font-style: italic;
  }

  /* Detection */
  .detect-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .detect-row input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: #2a2a3e;
    color: #ddd;
    border: 1px solid #444;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .detect-result {
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }

  /* Preset Selector */
  .preset-selector select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: #2a2a3e;
    color: #ddd;
    border: 1px solid #444;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .preset-info {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #252540;
    border-radius: 4px;
  }

  .preset-desc {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: #bbb;
  }

  .preset-models {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }

  .model-badge {
    background: #3a3a5e;
    padding: 0.15rem 0.5rem;
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.8rem;
    color: #a0a0ff;
  }

  /* Format Preview */
  .format-preview {
    background: #151525;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.85rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 300px;
    overflow-y: auto;
    color: #c0c0e0;
  }

  /* Token Counter */
  .token-input-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .token-input-row textarea {
    width: 100%;
    padding: 0.75rem;
    background: #2a2a3e;
    color: #ddd;
    border: 1px solid #444;
    border-radius: 4px;
    font-size: 0.9rem;
    resize: vertical;
    font-family: inherit;
  }

  .token-result {
    margin-top: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .token-count {
    font-size: 1.2rem;
    font-weight: bold;
    color: #7cc97c;
  }

  .token-meta {
    font-size: 0.85rem;
    color: #888;
  }

  .approx-badge {
    background: #3a3a20;
    color: #d0d060;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.75rem;
    margin-left: 0.25rem;
  }

  .exact-badge {
    background: #1a3a20;
    color: #60d060;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.75rem;
    margin-left: 0.25rem;
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
