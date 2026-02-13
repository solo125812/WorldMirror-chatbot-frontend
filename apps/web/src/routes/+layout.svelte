<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>WorldMirror Chat</title>
</svelte:head>

<div class="app">
  <header class="app-header">
    <h1>🌐 WorldMirror</h1>
    <nav>
      <a href="/chat">Chat</a>
      <a href="/characters">Characters</a>
      <a href="/instruct">Instruct</a>
      <a href="/quick-replies">Quick Replies</a>
      <a href="/plugins">Plugins</a>
      <a href="/extensions">Extensions</a>
      <a href="/indexing">Indexing</a>
      <a href="/logs">Logs</a>
      <a href="/settings">Settings</a>
    </nav>
  </header>

  <main class="app-main">
    {@render children()}
  </main>
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #0f0f0f;
    color: #e0e0e0;
    min-height: 100vh;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: #1a1a2e;
    border-bottom: 1px solid #2a2a3e;
  }

  .app-header h1 {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .app-header nav {
    display: flex;
    gap: 1rem;
  }

  .app-header nav a {
    color: #9090c0;
    text-decoration: none;
    font-size: 0.9rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: background 0.2s, color 0.2s;
  }

  .app-header nav a:hover {
    color: #c0c0ff;
    background: #2a2a3e;
  }

  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>
