<script lang="ts">
  let {
    status,
    variant = 'default',
  }: {
    status: string;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  } = $props();
</script>

<span class="badge {variant}">
  {status}
</span>

<style>
  .badge {
    display: inline-block;
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .default {
    background: #2a2a3e;
    color: #888;
  }

  .success {
    background: #1a3a1a;
    color: #88ff88;
  }

  .warning {
    background: #3a3a1a;
    color: #ffcc44;
  }

  .error {
    background: #3a1c1c;
    color: #ff8888;
  }

  .info {
    background: #1a2a3e;
    color: #88bbff;
  }
</style>
