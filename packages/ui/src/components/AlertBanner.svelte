<script lang="ts">
  let {
    message,
    variant = 'error',
    dismissible = true,
    ondismiss,
  }: {
    message: string;
    variant?: 'error' | 'warning' | 'info' | 'success';
    dismissible?: boolean;
    ondismiss?: () => void;
  } = $props();

  let visible = $state(true);

  function dismiss() {
    visible = false;
    ondismiss?.();
  }
</script>

{#if visible}
  <div class="alert alert-{variant}">
    <span class="alert-message">{message}</span>
    {#if dismissible}
      <button class="dismiss" onclick={dismiss}>✕</button>
    {/if}
  </div>
{/if}

<style>
  .alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .alert-info {
    background: #1a2a3e;
    border: 1px solid #2f4a6b;
    color: #88bbff;
  }

  .alert-success {
    background: #1a3a1c;
    border: 1px solid #2f6b3a;
    color: #88ff88;
  }

  .alert-message {
    flex: 1;
  }

  .dismiss {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    padding: 0 0.25rem;
    margin-left: 0.5rem;
    opacity: 0.7;
  }

  .dismiss:hover {
    opacity: 1;
  }
</style>
