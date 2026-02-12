<script lang="ts">
  /**
   * ModelPicker — Select model with provider icons and capability tags
   */

  interface Model {
    id: string;
    name: string;
    providerId: string;
    contextWindow: number;
    supportsTools: boolean;
    supportsVision: boolean;
    supportsStreaming: boolean;
  }

  interface Props {
    models?: Model[];
    selectedId?: string;
    onselect?: (id: string) => void;
  }

  let { models = [], selectedId, onselect }: Props = $props();

  const providerIcons: Record<string, string> = {
    mock: '🧪',
    anthropic: '🅰️',
    ollama: '🦙',
    openai: '🤖',
    google: '🔷',
    openrouter: '🌐',
  };

  function getProviderIcon(providerId: string): string {
    return providerIcons[providerId] ?? '🔌';
  }
</script>

<div class="model-picker">
  <h4>Model</h4>
  <div class="model-list">
    {#each models as model (model.id)}
      <button
        class="model-item"
        class:selected={model.id === selectedId}
        onclick={() => onselect?.(model.id)}
      >
        <span class="provider-icon">{getProviderIcon(model.providerId)}</span>
        <div class="model-info">
          <span class="model-name">{model.name}</span>
          <div class="capabilities">
            {#if model.supportsStreaming}
              <span class="cap-tag">stream</span>
            {/if}
            {#if model.supportsVision}
              <span class="cap-tag">vision</span>
            {/if}
            {#if model.supportsTools}
              <span class="cap-tag">tools</span>
            {/if}
            <span class="ctx-tag">{(model.contextWindow / 1000).toFixed(0)}k</span>
          </div>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .model-picker {
    padding: 0.75rem;
    background: #141428;
    border-radius: 8px;
    border: 1px solid #2a2a3e;
  }

  h4 {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    color: #c0c0e0;
  }

  .model-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .model-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.6rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    color: #e0e0e0;
    text-align: left;
    font-family: inherit;
    transition: all 0.15s;
    width: 100%;
  }

  .model-item:hover {
    background: #1e1e2e;
    border-color: #2a2a3e;
  }

  .model-item.selected {
    background: #2a3a5c;
    border-color: #4a5a8c;
  }

  .provider-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .model-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    overflow: hidden;
  }

  .model-name {
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .capabilities {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .cap-tag {
    font-size: 0.6rem;
    background: #2a3a5c;
    color: #8899cc;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
  }

  .ctx-tag {
    font-size: 0.6rem;
    background: #3a2a5c;
    color: #aa88cc;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
  }
</style>
