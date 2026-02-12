<script lang="ts">
  /**
   * SamplerPanel — Sliders for temperature, top_p, top_k, max_tokens, etc.
   */

  interface SamplerSettings {
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
    repetitionPenalty: number;
    presencePenalty: number;
    frequencyPenalty: number;
  }

  interface Props {
    settings?: Partial<SamplerSettings>;
    onchange?: (settings: SamplerSettings) => void;
  }

  let { settings = {}, onchange }: Props = $props();

  let values = $state<SamplerSettings>({
    temperature: settings.temperature ?? 0.8,
    topP: settings.topP ?? 0.95,
    topK: settings.topK ?? 40,
    maxTokens: settings.maxTokens ?? 1024,
    repetitionPenalty: settings.repetitionPenalty ?? 1.1,
    presencePenalty: settings.presencePenalty ?? 0,
    frequencyPenalty: settings.frequencyPenalty ?? 0,
  });

  function emitChange() {
    onchange?.(values);
  }

  const sliders = [
    { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.05 },
    { key: 'topP', label: 'Top P', min: 0, max: 1, step: 0.05 },
    { key: 'topK', label: 'Top K', min: 1, max: 200, step: 1 },
    { key: 'maxTokens', label: 'Max Tokens', min: 64, max: 8192, step: 64 },
    { key: 'repetitionPenalty', label: 'Repetition Penalty', min: 1, max: 2, step: 0.05 },
    { key: 'presencePenalty', label: 'Presence Penalty', min: -2, max: 2, step: 0.1 },
    { key: 'frequencyPenalty', label: 'Frequency Penalty', min: -2, max: 2, step: 0.1 },
  ] as const;
</script>

<div class="sampler-panel">
  <h4>Sampler Settings</h4>

  {#each sliders as slider}
    <div class="slider-row">
      <label for="sampler-{slider.key}">{slider.label}</label>
      <div class="slider-control">
        <input
          id="sampler-{slider.key}"
          type="range"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          bind:value={values[slider.key]}
          oninput={emitChange}
        />
        <span class="value">{values[slider.key]}</span>
      </div>
    </div>
  {/each}
</div>

<style>
  .sampler-panel {
    padding: 1rem;
    background: #141428;
    border-radius: 8px;
    border: 1px solid #2a2a3e;
  }

  h4 {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    color: #c0c0e0;
  }

  .slider-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-bottom: 0.75rem;
  }

  .slider-row label {
    font-size: 0.75rem;
    color: #8888aa;
  }

  .slider-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .slider-control input[type="range"] {
    flex: 1;
    accent-color: #6688cc;
    height: 4px;
  }

  .value {
    font-size: 0.75rem;
    color: #c0c0e0;
    min-width: 3rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
