<script lang="ts">
  /**
   * SwipeControls — Left/right arrows on assistant messages for swipe navigation
   */

  interface Props {
    currentIndex: number;
    totalSwipes: number;
    onprevious?: () => void;
    onnext?: () => void;
    ongenerate?: () => void;
    isGenerating?: boolean;
  }

  let { currentIndex, totalSwipes, onprevious, onnext, ongenerate, isGenerating = false }: Props = $props();

  let isFirst = $derived(currentIndex === 0);
  let isLast = $derived(currentIndex >= totalSwipes - 1);
</script>

{#if totalSwipes > 0}
  <div class="swipe-controls">
    <button
      class="swipe-btn"
      onclick={onprevious}
      disabled={isFirst}
      title="Previous response"
    >
      ◀
    </button>

    <span class="swipe-counter">{currentIndex + 1}/{totalSwipes}</span>

    <button
      class="swipe-btn"
      onclick={() => {
        if (isLast) {
          ongenerate?.();
        } else {
          onnext?.();
        }
      }}
      disabled={isGenerating}
      title={isLast ? 'Generate new response' : 'Next response'}
    >
      {#if isGenerating}
        ⏳
      {:else if isLast}
        ⟳
      {:else}
        ▶
      {/if}
    </button>
  </div>
{/if}

<style>
  .swipe-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .swipe-controls:hover {
    opacity: 1;
  }

  .swipe-btn {
    background: #2a2a3e;
    border: none;
    color: #c0c0e0;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .swipe-btn:hover:not(:disabled) {
    background: #3a3a4e;
  }

  .swipe-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .swipe-counter {
    font-size: 0.75rem;
    color: #888;
    min-width: 2rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
</style>
