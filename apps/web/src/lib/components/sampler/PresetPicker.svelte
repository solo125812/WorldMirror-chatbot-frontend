<script lang="ts">
  /**
   * PresetPicker — Dropdown to select/save sampler presets
   */

  interface Preset {
    id: string;
    name: string;
    description: string;
    source: 'system' | 'user';
  }

  interface Props {
    presets?: Preset[];
    selectedId?: string;
    onselect?: (id: string) => void;
    onsave?: () => void;
  }

  let { presets = [], selectedId, onselect, onsave }: Props = $props();
</script>

<div class="preset-picker">
  <label for="preset-select">Preset</label>
  <div class="picker-row">
    <select
      id="preset-select"
      value={selectedId}
      onchange={(e) => onselect?.((e.target as HTMLSelectElement).value)}
    >
      {#each presets as preset (preset.id)}
        <option value={preset.id}>
          {preset.name} {preset.source === 'system' ? '🔒' : ''}
        </option>
      {/each}
    </select>
    <button class="save-btn" onclick={onsave} title="Save current as preset">💾</button>
  </div>
</div>

<style>
  .preset-picker {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  label {
    font-size: 0.75rem;
    color: #8888aa;
  }

  .picker-row {
    display: flex;
    gap: 0.5rem;
  }

  select {
    flex: 1;
    background: #0f0f1f;
    border: 1px solid #2a2a3e;
    color: #e0e0e0;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    outline: none;
    cursor: pointer;
  }

  select:focus {
    border-color: #4a4a8a;
  }

  .save-btn {
    background: #2a2a3e;
    border: none;
    color: #c0c0e0;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.15s;
  }

  .save-btn:hover {
    background: #3a3a4e;
  }
</style>
