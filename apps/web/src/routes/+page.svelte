<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/chat');
  });
</script>

<div style="display: flex; align-items: center; justify-content: center; height: 80vh;">
  <p>Redirecting to chat...</p>
</div>
