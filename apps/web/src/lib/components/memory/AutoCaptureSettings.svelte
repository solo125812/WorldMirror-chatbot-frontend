<script lang="ts">
  /**
   * AutoCaptureSettings — Toggle capture rules and thresholds
   * Controls which patterns trigger automatic memory storage.
   */

  interface Trigger {
    id: string;
    name: string;
    pattern: string;
    category: string;
    enabled: boolean;
  }

  interface Props {
    enabled?: boolean;
    maxPerTurn?: number;
    deduplicationThreshold?: number;
    triggers?: Trigger[];
    onchange?: (config: {
      enabled: boolean;
      maxPerTurn: number;
      deduplicationThreshold: number;
      triggers: Trigger[];
    }) => void;
  }

  let {
    enabled = true,
    maxPerTurn = 3,
    deduplicationThreshold = 0.95,
    triggers = [
      { id: 'remember', name: 'Explicit Remember', pattern: "remember this|remember that|don't forget|do not forget", category: 'fact', enabled: true },
      { id: 'preference', name: 'User Preferences', pattern: 'i prefer|i like|i hate|i love|i want|i need', category: 'preference', enabled: true },
      { id: 'decision', name: 'Decisions', pattern: "we decided|let's use|we'll go with|we should use", category: 'decision', enabled: true },
      { id: 'identity', name: 'Identity Statements', pattern: 'my .+ is|is my|i am a|i work as|i live in', category: 'entity', enabled: true },
      { id: 'important', name: 'Importance Markers', pattern: 'always|never|important to me|crucial|essential', category: 'fact', enabled: true },
      { id: 'email', name: 'Email Addresses', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+', category: 'entity', enabled: true },
      { id: 'phone', name: 'Phone Numbers', pattern: '\\+\\d{10,}', category: 'entity', enabled: true },
    ],
    onchange,
  }: Props = $props();

  let isEnabled = $state(enabled);
  let maxCaptures = $state(maxPerTurn);
  let dedupThreshold = $state(deduplicationThreshold);
  let triggerList = $state<Trigger[]>(triggers.map(t => ({ ...t })));

  function emitChange() {
    onchange?.({
      enabled: isEnabled,
      maxPerTurn: maxCaptures,
      deduplicationThreshold: dedupThreshold,
      triggers: triggerList,
    });
  }

  function toggleTrigger(id: string) {
    triggerList = triggerList.map(t =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    emitChange();
  }

  function categoryColor(category: string): string {
    switch (category) {
      case 'preference': return '#6688dd';
      case 'decision': return '#dd8844';
      case 'entity': return '#44bb88';
      case 'fact': return '#aa88dd';
      default: return '#8888aa';
    }
  }
</script>

<div class="auto-capture-settings">
  <div class="header">
    <h3>🧲 Auto-Capture</h3>
    <label class="toggle">
      <input
        type="checkbox"
        bind:checked={isEnabled}
        onchange={emitChange}
      />
      <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
    </label>
  </div>

  {#if isEnabled}
    <div class="settings-grid">
      <div class="setting">
        <label for="max-captures">Max captures per turn</label>
        <input
          id="max-captures"
          type="number"
          min="1"
          max="10"
          bind:value={maxCaptures}
          onchange={emitChange}
        />
      </div>

      <div class="setting">
        <label for="dedup-threshold">Dedup threshold</label>
        <div class="slider-control">
          <input
            id="dedup-threshold"
            type="range"
            min="0.5"
            max="1.0"
            step="0.01"
            bind:value={dedupThreshold}
            oninput={emitChange}
          />
          <span class="value">{dedupThreshold.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <h4>Capture Triggers</h4>
    <div class="triggers">
      {#each triggerList as trigger}
        <div class="trigger-item" class:disabled={!trigger.enabled}>
          <label class="trigger-toggle">
            <input
              type="checkbox"
              checked={trigger.enabled}
              onchange={() => toggleTrigger(trigger.id)}
            />
          </label>
          <div class="trigger-info">
            <span class="trigger-name">{trigger.name}</span>
            <span
              class="trigger-category"
              style="color: {categoryColor(trigger.category)}"
            >
              {trigger.category}
            </span>
          </div>
          <code class="trigger-pattern">{trigger.pattern}</code>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .auto-capture-settings {
    padding: 1rem;
    background: #141428;
    border-radius: 8px;
    border: 1px solid #2a2a3e;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    color: #e0e0ff;
  }

  h4 {
    margin: 0.75rem 0 0.5rem;
    font-size: 0.85rem;
    color: #c0c0e0;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: #8888aa;
    cursor: pointer;
  }

  .toggle input {
    accent-color: #5070cc;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .setting label {
    display: block;
    font-size: 0.7rem;
    color: #6666aa;
    margin-bottom: 0.25rem;
  }

  .setting input[type="number"] {
    width: 60px;
    padding: 0.3rem 0.4rem;
    background: #0e0e1e;
    border: 1px solid #2a2a3e;
    border-radius: 4px;
    color: #e0e0ff;
    font-size: 0.8rem;
  }

  .slider-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .slider-control input[type="range"] {
    flex: 1;
  }

  .slider-control .value {
    font-size: 0.75rem;
    color: #c0c0e0;
    min-width: 2.5rem;
  }

  .triggers {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .trigger-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: #0e0e1e;
    border: 1px solid #1e1e3a;
    border-radius: 4px;
    transition: opacity 0.2s;
  }

  .trigger-item.disabled {
    opacity: 0.5;
  }

  .trigger-toggle input {
    accent-color: #5070cc;
  }

  .trigger-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 120px;
  }

  .trigger-name {
    font-size: 0.75rem;
    color: #c0c0e0;
  }

  .trigger-category {
    font-size: 0.65rem;
  }

  .trigger-pattern {
    font-size: 0.65rem;
    color: #6666aa;
    background: #141428;
    padding: 0.15rem 0.3rem;
    border-radius: 3px;
    word-break: break-all;
    flex: 1;
  }
</style>
