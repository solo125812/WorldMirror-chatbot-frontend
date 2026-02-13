<script lang="ts">
  /**
   * MemoryInspector — Shows retrieved memory hits for the current prompt.
   * Displays what memory was injected into the last generation.
   */

  interface MemoryHit {
    id: string;
    content: string;
    category: string;
    scope: string;
    sourceId?: string;
    importance: number;
    score: number;
    source: 'vector' | 'keyword' | 'file';
    createdAt: string;
  }

  interface Props {
    apiBase?: string;
  }

  let { apiBase = 'http://localhost:3001' }: Props = $props();

  let query = $state('');
  let scope = $state<string>('');
  let results = $state<MemoryHit[]>([]);
  let searching = $state(false);
  let searched = $state(false);

  async function handleSearch() {
    if (!query.trim()) return;
    searching = true;
    searched = false;
    try {
      const params = new URLSearchParams({ q: query });
      if (scope) params.set('scope', scope);

      const res = await fetch(`${apiBase}/memory/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      results = (data.results ?? []).map((r: any) => ({
        id: r.entry.id,
        content: r.entry.content,
        category: r.entry.category,
        scope: r.entry.scope,
        sourceId: r.entry.sourceId,
        importance: r.entry.importance,
        score: r.score,
        source: r.source,
        createdAt: r.entry.createdAt,
      }));
      searched = true;
    } catch {
      results = [];
      searched = true;
    } finally {
      searching = false;
    }
  }

  async function deleteEntry(id: string) {
    try {
      await fetch(`${apiBase}/memory/${id}`, { method: 'DELETE' });
      results = results.filter((r) => r.id !== id);
    } catch {
      // Ignore
    }
  }

  function scoreColor(score: number): string {
    if (score >= 0.7) return '#44cc44';
    if (score >= 0.4) return '#cccc44';
    return '#cc8844';
  }

  function sourceIcon(source: string): string {
    switch (source) {
      case 'vector': return '🔮';
      case 'keyword': return '🔤';
      case 'file': return '📄';
      default: return '❓';
    }
  }
</script>

<div class="memory-inspector">
  <h3>🔍 Memory Inspector</h3>

  <div class="search-form">
    <input
      type="text"
      placeholder="Search memory..."
      bind:value={query}
      onkeydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <select bind:value={scope}>
      <option value="">All scopes</option>
      <option value="global">Global</option>
      <option value="character">Character</option>
      <option value="chat">Chat</option>
    </select>
    <button onclick={handleSearch} disabled={searching || !query.trim()}>
      {searching ? '...' : 'Search'}
    </button>
  </div>

  {#if searched}
    <div class="results-header">
      <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
    </div>
  {/if}

  <div class="results">
    {#each results as hit}
      <div class="hit-card">
        <div class="hit-header">
          <span class="hit-source" title={hit.source}>{sourceIcon(hit.source)}</span>
          <span class="hit-category">{hit.category}</span>
          <span class="hit-scope">{hit.scope}</span>
          <span class="hit-score" style="color: {scoreColor(hit.score)}">
            {(hit.score * 100).toFixed(0)}%
          </span>
          <button class="hit-delete" onclick={() => deleteEntry(hit.id)} title="Delete">✕</button>
        </div>
        <div class="hit-content">{hit.content}</div>
        <div class="hit-meta">
          importance: {hit.importance.toFixed(2)} · {new Date(hit.createdAt).toLocaleString()}
        </div>
      </div>
    {:else}
      {#if searched}
        <p class="empty">No memory hits found.</p>
      {:else}
        <p class="empty">Enter a query to search memory.</p>
      {/if}
    {/each}
  </div>
</div>

<style>
  .memory-inspector {
    padding: 1rem;
    background: #141428;
    border-radius: 8px;
    border: 1px solid #2a2a3e;
  }

  h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    color: #e0e0ff;
  }

  .search-form {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .search-form input {
    flex: 1;
    padding: 0.4rem 0.5rem;
    background: #0e0e1e;
    border: 1px solid #2a2a3e;
    border-radius: 4px;
    color: #e0e0ff;
    font-size: 0.8rem;
  }

  .search-form select {
    padding: 0.4rem;
    background: #0e0e1e;
    border: 1px solid #2a2a3e;
    border-radius: 4px;
    color: #c0c0e0;
    font-size: 0.75rem;
  }

  .search-form button {
    padding: 0.4rem 0.75rem;
    background: #3050aa;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .search-form button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .results-header {
    font-size: 0.75rem;
    color: #6666aa;
    margin-bottom: 0.5rem;
  }

  .hit-card {
    padding: 0.5rem;
    background: #0e0e1e;
    border: 1px solid #1e1e3a;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .hit-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }

  .hit-source {
    font-size: 0.9rem;
  }

  .hit-category {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    background: #2a2a5e;
    border-radius: 3px;
    color: #b0b0ff;
  }

  .hit-scope {
    font-size: 0.65rem;
    color: #6666aa;
  }

  .hit-score {
    font-size: 0.75rem;
    font-weight: bold;
    margin-left: auto;
  }

  .hit-delete {
    padding: 0.1rem 0.3rem;
    background: transparent;
    border: 1px solid #3a2020;
    border-radius: 3px;
    color: #aa6666;
    cursor: pointer;
    font-size: 0.65rem;
  }

  .hit-content {
    font-size: 0.8rem;
    color: #c0c0e0;
    line-height: 1.4;
    margin-bottom: 0.3rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .hit-meta {
    font-size: 0.65rem;
    color: #555588;
  }

  .empty {
    font-size: 0.8rem;
    color: #6666aa;
    text-align: center;
    padding: 1rem;
  }
</style>
