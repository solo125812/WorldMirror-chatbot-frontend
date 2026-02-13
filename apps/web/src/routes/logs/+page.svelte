<script lang="ts">
  import {
    queryLogs,
    clearLogs,
    setLogLevel,
    getDiagnosticsDownloadUrl,
  } from '$lib/api/diagnostics.js';
  import { untrack } from 'svelte';
  import type { LogEntry, LogsResponse } from '$lib/api/diagnostics.js';

  let entries = $state<LogEntry[]>([]);
  let stats = $state<Record<string, number>>({});
  let subsystems = $state<string[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filters
  let filterLevel = $state('');
  let filterSubsystem = $state('');
  let filterLimit = $state(200);
  let autoRefresh = $state(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Log level control
  let newLevel = $state('info');
  let newLevelSubsystem = $state('');

  async function loadLogs() {
    loading = true;
    error = null;
    try {
      const result: LogsResponse = await queryLogs({
        level: filterLevel || undefined,
        subsystem: filterSubsystem || undefined,
        limit: filterLimit,
      });
      entries = result.entries;
      stats = result.stats;
      subsystems = result.subsystems;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load logs';
    } finally {
      loading = false;
    }
  }

  async function handleClear() {
    if (!confirm('Clear all buffered log entries?')) return;
    try {
      await clearLogs();
      await loadLogs();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to clear logs';
    }
  }

  async function handleSetLevel() {
    try {
      await setLogLevel(newLevel, newLevelSubsystem || undefined);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to set log level';
    }
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      refreshInterval = setInterval(loadLogs, 3000);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  function levelColor(level: string): string {
    switch (level) {
      case 'error': return '#ff6666';
      case 'warn': return '#ffcc44';
      case 'info': return '#66aaff';
      case 'debug': return '#888888';
      default: return '#cccccc';
    }
  }

  $effect(() => {
    untrack(() => { loadLogs(); });
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });
</script>

<div class="page">
  <div class="page-header">
    <div class="header-row">
      <div>
        <h2>📋 Log Viewer</h2>
        <p class="subtitle">View application logs and diagnostics</p>
      </div>
      <div class="header-actions">
        <button class="btn" class:btn-active={autoRefresh} onclick={toggleAutoRefresh}>
          {autoRefresh ? '⏸ Pause' : '▶ Auto-Refresh'}
        </button>
        <button class="btn btn-secondary" onclick={loadLogs}>🔄 Refresh</button>
        <button class="btn btn-danger" onclick={handleClear}>🗑 Clear</button>
        <a class="btn btn-secondary" href={getDiagnosticsDownloadUrl()} download>
          📦 Export Diagnostics
        </a>
      </div>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <!-- Stats -->
  <div class="stats-bar">
    <div class="stat" style="color: #ff6666">
      <span class="stat-count">{stats.error ?? 0}</span> errors
    </div>
    <div class="stat" style="color: #ffcc44">
      <span class="stat-count">{stats.warn ?? 0}</span> warnings
    </div>
    <div class="stat" style="color: #66aaff">
      <span class="stat-count">{stats.info ?? 0}</span> info
    </div>
    <div class="stat" style="color: #888">
      <span class="stat-count">{stats.debug ?? 0}</span> debug
    </div>
    <div class="stat">
      <span class="stat-count">{entries.length}</span> shown
    </div>
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="filter-group">
      <label for="filter-level">Level</label>
      <select id="filter-level" bind:value={filterLevel} class="input" onchange={loadLogs}>
        <option value="">All</option>
        <option value="error">Error</option>
        <option value="warn">Warning</option>
        <option value="info">Info</option>
        <option value="debug">Debug</option>
      </select>
    </div>
    <div class="filter-group">
      <label for="filter-subsystem">Subsystem</label>
      <select id="filter-subsystem" bind:value={filterSubsystem} class="input" onchange={loadLogs}>
        <option value="">All</option>
        {#each subsystems as sub}
          <option value={sub}>{sub}</option>
        {/each}
      </select>
    </div>
    <div class="filter-group">
      <label for="filter-limit">Limit</label>
      <select id="filter-limit" bind:value={filterLimit} class="input" onchange={loadLogs}>
        <option value={50}>50</option>
        <option value={100}>100</option>
        <option value={200}>200</option>
        <option value={500}>500</option>
        <option value={1000}>1000</option>
      </select>
    </div>
    <div class="filter-group level-control">
      <label>Set Level</label>
      <div class="level-row">
        <select bind:value={newLevel} class="input small">
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <input
          type="text"
          bind:value={newLevelSubsystem}
          class="input small"
          placeholder="subsystem (optional)"
        />
        <button class="btn btn-primary small" onclick={handleSetLevel}>Set</button>
      </div>
    </div>
  </div>

  <!-- Log Entries -->
  {#if loading && entries.length === 0}
    <div class="loading">Loading logs...</div>
  {:else if entries.length === 0}
    <div class="empty-state">
      <p>No log entries match your filters.</p>
    </div>
  {:else}
    <div class="log-table">
      <div class="log-header-row">
        <span class="col-time">Timestamp</span>
        <span class="col-level">Level</span>
        <span class="col-subsystem">Subsystem</span>
        <span class="col-message">Message</span>
      </div>
      {#each entries as entry, i (i)}
        <div class="log-row" class:error={entry.level === 'error'} class:warn={entry.level === 'warn'}>
          <span class="col-time">{entry.timestamp.substring(11, 23)}</span>
          <span class="col-level" style="color: {levelColor(entry.level)}">
            {entry.level.toUpperCase()}
          </span>
          <span class="col-subsystem">{entry.subsystem}</span>
          <span class="col-message">
            {entry.message}
            {#if entry.data}
              <span class="log-data">{JSON.stringify(entry.data)}</span>
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .page-header {
    margin-bottom: 1rem;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .page-header h2 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: #888;
    font-size: 0.9rem;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .alert {
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

  .stats-bar {
    display: flex;
    gap: 1.5rem;
    padding: 0.75rem 1rem;
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .stat {
    font-size: 0.85rem;
  }

  .stat-count {
    font-weight: 700;
    font-size: 1rem;
  }

  .filters {
    display: flex;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .filter-group label {
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .level-control {
    margin-left: auto;
  }

  .level-row {
    display: flex;
    gap: 0.25rem;
  }

  .input {
    padding: 0.35rem 0.5rem;
    background: #0f0f1a;
    border: 1px solid #2a2a3e;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 0.85rem;
  }

  .input.small {
    width: 100px;
  }

  .input:focus {
    outline: none;
    border-color: #4a4a7e;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #888;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #888;
    background: #1a1a2e;
    border-radius: 8px;
    border: 1px dashed #2a2a3e;
  }

  .log-table {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.8rem;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    overflow: hidden;
  }

  .log-header-row {
    display: flex;
    padding: 0.5rem 0.75rem;
    background: #1a1a2e;
    border-bottom: 1px solid #2a2a3e;
    font-weight: 600;
    color: #aaa;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .log-row {
    display: flex;
    padding: 0.35rem 0.75rem;
    border-bottom: 1px solid #1a1a2e;
    transition: background 0.1s;
  }

  .log-row:hover {
    background: #1a1a2e;
  }

  .log-row.error {
    background: #1a0f0f;
  }

  .log-row.warn {
    background: #1a180f;
  }

  .col-time {
    width: 100px;
    flex-shrink: 0;
    color: #666;
  }

  .col-level {
    width: 60px;
    flex-shrink: 0;
    font-weight: 600;
  }

  .col-subsystem {
    width: 100px;
    flex-shrink: 0;
    color: #8888cc;
  }

  .col-message {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .log-data {
    color: #666;
    margin-left: 0.5rem;
  }

  .btn {
    padding: 0.35rem 0.65rem;
    border: 1px solid #3a3a5e;
    border-radius: 4px;
    background: #2a2a3e;
    color: #ccc;
    cursor: pointer;
    font-size: 0.8rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: background 0.2s, color 0.2s;
  }

  .btn:hover:not(:disabled) {
    background: #3a3a5e;
    color: #fff;
  }

  .btn.small {
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }

  .btn-active {
    background: #1a3a1a;
    border-color: #3a5a3a;
    color: #88ff88;
  }

  .btn-primary {
    background: #2a3a5e;
    border-color: #3a5a8e;
    color: #88bbff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #3a5a8e;
    color: #fff;
  }

  .btn-secondary {
    background: #2a2a3e;
    border-color: #3a3a5e;
  }

  .btn-danger {
    background: #3a1c1c;
    border-color: #6b2f2f;
    color: #ff8888;
  }

  .btn-danger:hover:not(:disabled) {
    background: #5a2a2a;
    color: #ffaaaa;
  }
</style>
