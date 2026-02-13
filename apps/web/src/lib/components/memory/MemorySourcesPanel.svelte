<script lang="ts">
  /**
   * MemorySourcesPanel — Lists memory sources (documents, summaries, entries)
   * Shows ingested documents and memory entry counts by category.
   */

  interface Document {
    id: string;
    title: string;
    sourceType: string;
    sourceUri?: string;
    mimeType?: string;
    sizeBytes: number;
    chunkCount: number;
    createdAt: string;
  }

  interface MemoryStats {
    total: number;
    byCategory: Record<string, number>;
  }

  interface Props {
    apiBase?: string;
  }

  let { apiBase = 'http://localhost:3001' }: Props = $props();

  let documents = $state<Document[]>([]);
  let stats = $state<MemoryStats>({ total: 0, byCategory: {} });
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Ingest form
  let ingestType = $state<'text' | 'url'>('text');
  let ingestContent = $state('');
  let ingestUrl = $state('');
  let ingestTitle = $state('');
  let ingesting = $state(false);

  async function loadDocuments() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${apiBase}/memory/documents`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      documents = data.documents ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load documents';
    } finally {
      loading = false;
    }
  }

  async function loadStats() {
    try {
      const res = await fetch(`${apiBase}/memory/entries?limit=0`);
      if (!res.ok) return;
      const data = await res.json();
      stats.total = data.total ?? 0;

      // Load entries to count by category
      const entriesRes = await fetch(`${apiBase}/memory/entries?limit=1000`);
      if (entriesRes.ok) {
        const entriesData = await entriesRes.json();
        const categories: Record<string, number> = {};
        for (const entry of entriesData.entries ?? []) {
          categories[entry.category] = (categories[entry.category] ?? 0) + 1;
        }
        stats = { total: entriesData.total, byCategory: categories };
      }
    } catch {
      // Stats are non-critical
    }
  }

  async function handleIngest() {
    ingesting = true;
    error = null;
    try {
      const body: Record<string, string> = { type: ingestType };
      if (ingestType === 'text') {
        body.content = ingestContent;
      } else {
        body.url = ingestUrl;
      }
      if (ingestTitle) body.title = ingestTitle;

      const res = await fetch(`${apiBase}/memory/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      // Reset form
      ingestContent = '';
      ingestUrl = '';
      ingestTitle = '';

      // Reload
      await Promise.all([loadDocuments(), loadStats()]);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Ingestion failed';
    } finally {
      ingesting = false;
    }
  }

  async function deleteDocument(id: string) {
    try {
      const res = await fetch(`${apiBase}/memory/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadDocuments();
      }
    } catch {
      // Ignore
    }
  }

  // Load on mount
  $effect(() => {
    loadDocuments();
    loadStats();
  });

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
</script>

<div class="memory-sources">
  <h3>📚 Memory Sources</h3>

  <!-- Stats -->
  <div class="stats-bar">
    <span class="stat">Total entries: <strong>{stats.total}</strong></span>
    {#each Object.entries(stats.byCategory) as [cat, count]}
      <span class="stat-badge">{cat}: {count}</span>
    {/each}
  </div>

  <!-- Ingest Form -->
  <div class="ingest-form">
    <h4>Add Memory Source</h4>
    <div class="type-select">
      <button class:active={ingestType === 'text'} onclick={() => ingestType = 'text'}>Text</button>
      <button class:active={ingestType === 'url'} onclick={() => ingestType = 'url'}>URL</button>
    </div>

    <input
      type="text"
      placeholder="Title (optional)"
      bind:value={ingestTitle}
    />

    {#if ingestType === 'text'}
      <textarea
        placeholder="Paste text content to ingest..."
        bind:value={ingestContent}
        rows="4"
      ></textarea>
    {:else}
      <input
        type="url"
        placeholder="https://example.com/document"
        bind:value={ingestUrl}
      />
    {/if}

    <button
      class="ingest-btn"
      onclick={handleIngest}
      disabled={ingesting || (ingestType === 'text' ? !ingestContent : !ingestUrl)}
    >
      {ingesting ? 'Ingesting...' : 'Ingest'}
    </button>
  </div>

  <!-- Error -->
  {#if error}
    <div class="error">{error}</div>
  {/if}

  <!-- Documents List -->
  <div class="documents">
    <h4>Ingested Documents ({documents.length})</h4>
    {#if loading}
      <p class="loading">Loading...</p>
    {:else if documents.length === 0}
      <p class="empty">No documents ingested yet.</p>
    {:else}
      {#each documents as doc}
        <div class="doc-item">
          <div class="doc-info">
            <span class="doc-title">{doc.title}</span>
            <span class="doc-meta">
              {doc.sourceType} · {doc.chunkCount} chunks · {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}
            </span>
          </div>
          <button class="delete-btn" onclick={() => deleteDocument(doc.id)} title="Delete">✕</button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .memory-sources {
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

  h4 {
    margin: 0.75rem 0 0.5rem;
    font-size: 0.85rem;
    color: #c0c0e0;
  }

  .stats-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .stat {
    font-size: 0.8rem;
    color: #8888aa;
  }

  .stat-badge {
    font-size: 0.7rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: #1e1e3a;
    color: #a0a0d0;
  }

  .ingest-form {
    background: #0e0e1e;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .type-select {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .type-select button {
    padding: 0.3rem 0.75rem;
    border: 1px solid #3a3a5e;
    border-radius: 4px;
    background: transparent;
    color: #8888aa;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .type-select button.active {
    background: #2a2a5e;
    color: #c0c0ff;
    border-color: #5050aa;
  }

  input, textarea {
    width: 100%;
    padding: 0.4rem 0.5rem;
    background: #141428;
    border: 1px solid #2a2a3e;
    border-radius: 4px;
    color: #e0e0ff;
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
    box-sizing: border-box;
    font-family: inherit;
  }

  textarea {
    resize: vertical;
  }

  .ingest-btn {
    padding: 0.4rem 1rem;
    background: #3050aa;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .ingest-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    color: #ff6666;
    font-size: 0.8rem;
    margin: 0.5rem 0;
    padding: 0.5rem;
    background: #2a1010;
    border-radius: 4px;
  }

  .doc-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem;
    border-bottom: 1px solid #1e1e3a;
  }

  .doc-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .doc-title {
    font-size: 0.85rem;
    color: #d0d0ff;
  }

  .doc-meta {
    font-size: 0.7rem;
    color: #6666aa;
  }

  .delete-btn {
    padding: 0.2rem 0.4rem;
    background: transparent;
    border: 1px solid #3a2020;
    border-radius: 4px;
    color: #aa6666;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .delete-btn:hover {
    background: #2a1010;
  }

  .loading, .empty {
    font-size: 0.8rem;
    color: #6666aa;
    text-align: center;
    padding: 1rem;
  }
</style>
