<script lang="ts">
  import {
    getIndexerStatus,
    startIndexing,
    stopIndexing,
    listIndexJobs,
  } from '$lib/api/indexer.js';
  import { untrack } from 'svelte';
  import type { IndexStatus, IndexJob } from '@chatbot/types';

  let status = $state<IndexStatus | null>(null);
  let jobs = $state<IndexJob[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let actionError = $state<string | null>(null);

  // Start form
  let workspacePath = $state('');
  let indexMode = $state<'full' | 'incremental'>('full');
  let ignorePatterns = $state('');
  let starting = $state(false);

  // Polling
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function loadStatus() {
    try {
      status = await getIndexerStatus();
    } catch (e) {
      // Non-critical — status might not be available
    }
  }

  async function loadJobs() {
    loading = true;
    error = null;
    try {
      jobs = await listIndexJobs({ limit: 20 });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load jobs';
    } finally {
      loading = false;
    }
  }

  async function loadAll() {
    await Promise.all([loadStatus(), loadJobs()]);
  }

  async function handleStart() {
    if (!workspacePath.trim()) return;
    starting = true;
    actionError = null;
    try {
      const patterns = ignorePatterns
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);
      await startIndexing({
        workspacePath: workspacePath.trim(),
        mode: indexMode,
        ignorePatterns: patterns.length > 0 ? patterns : undefined,
      });
      await loadAll();
      startPolling();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Failed to start indexing';
    } finally {
      starting = false;
    }
  }

  async function handleStop() {
    actionError = null;
    try {
      await stopIndexing();
      stopPolling();
      await loadAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Failed to stop indexing';
    }
  }

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(async () => {
      await loadStatus();
      if (status?.status !== 'running' && status?.status !== 'pending') {
        stopPolling();
        await loadJobs();
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  }

  function progressPercent(job: IndexJob): number {
    if (job.totalFiles === 0) return 0;
    return Math.round((job.processedFiles / job.totalFiles) * 100);
  }

  $effect(() => {
    untrack(() => { loadAll(); });
    return () => stopPolling();
  });
</script>

<div class="page">
  <div class="page-header">
    <h2>📂 Code Indexing</h2>
    <p class="subtitle">Index codebases for semantic search in conversations</p>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if actionError}
    <div class="alert alert-warning">{actionError}</div>
  {/if}

  <!-- Current Status -->
  {#if status}
    <div class="status-card" class:active={status.status === 'running'}>
      <div class="status-header">
        <h3>Current Status</h3>
        <span class="status-badge" class:running={status.status === 'running'} class:idle={status.status === 'idle'}>
          {status.status.toUpperCase()}
        </span>
      </div>
      {#if status.status === 'running' && status.progress}
        <div class="progress-section">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {status.progress.totalFiles > 0
                ? (status.progress.processedFiles / status.progress.totalFiles) * 100
                : 0}%"
            ></div>
          </div>
          <div class="progress-text">
            {status.progress.processedFiles} / {status.progress.totalFiles} files processed
            · {status.progress.totalChunks} chunks created
          </div>
          <button class="btn btn-danger" onclick={handleStop}>Stop Indexing</button>
        </div>
      {:else if status.status === 'idle'}
        <p class="idle-text">No indexing job is running.</p>
      {/if}
    </div>
  {/if}

  <!-- Start Indexing -->
  <div class="start-section">
    <h3>Start Indexing</h3>
    <div class="form-group">
      <label for="workspace-path">Workspace Path</label>
      <input
        id="workspace-path"
        type="text"
        bind:value={workspacePath}
        placeholder="/path/to/your/project"
        class="input"
      />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="index-mode">Mode</label>
        <select id="index-mode" bind:value={indexMode} class="input">
          <option value="full">Full Index</option>
          <option value="incremental">Incremental Update</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label for="ignore-patterns">Ignore Patterns (one per line)</label>
      <textarea
        id="ignore-patterns"
        bind:value={ignorePatterns}
        placeholder="node_modules&#10;dist&#10;.git"
        class="input textarea"
        rows="3"
      ></textarea>
    </div>
    <button
      class="btn btn-primary"
      onclick={handleStart}
      disabled={starting || !workspacePath.trim() || status?.status === 'running'}
    >
      {starting ? 'Starting...' : '▶ Start Indexing'}
    </button>
  </div>

  <!-- Job History -->
  <div class="jobs-section">
    <h3>Job History</h3>
    {#if loading}
      <div class="loading">Loading jobs...</div>
    {:else if jobs.length === 0}
      <div class="empty-state">
        <p>No indexing jobs yet.</p>
      </div>
    {:else}
      <div class="job-list">
        {#each jobs as job (job.id)}
          <div class="job-card">
            <div class="job-header">
              <span class="job-path">{job.workspacePath}</span>
              <span
                class="job-status"
                class:completed={job.status === 'completed'}
                class:failed={job.status === 'failed'}
                class:running={job.status === 'running'}
                class:cancelled={job.status === 'cancelled'}
              >
                {job.status}
              </span>
            </div>
            <div class="job-meta">
              <span>Mode: {job.mode}</span>
              <span>Files: {job.processedFiles}/{job.totalFiles}</span>
              <span>Chunks: {job.totalChunks}</span>
              <span>Started: {formatDate(job.startedAt)}</span>
              {#if job.completedAt}
                <span>Completed: {formatDate(job.completedAt)}</span>
              {/if}
            </div>
            {#if job.status === 'running'}
              <div class="progress-bar small">
                <div class="progress-fill" style="width: {progressPercent(job)}%"></div>
              </div>
            {/if}
            {#if job.error}
              <div class="job-error">{job.error}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .page-header {
    margin-bottom: 1.5rem;
  }

  .page-header h2 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: #888;
    font-size: 0.9rem;
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

  .alert-warning {
    background: #3a2e1c;
    border: 1px solid #6b5a2f;
    color: #ffcc88;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #888;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #888;
    background: #1a1a2e;
    border-radius: 8px;
    border: 1px dashed #2a2a3e;
  }

  .status-card {
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .status-card.active {
    border-color: #3a5a3a;
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .status-header h3 {
    font-size: 1rem;
  }

  .status-badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: #2a2a3e;
    color: #888;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .status-badge.running {
    background: #1a3a1a;
    color: #88ff88;
    animation: pulse 2s ease-in-out infinite;
  }

  .status-badge.idle {
    background: #2a2a3e;
    color: #888;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #2a2a3e;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar.small {
    height: 4px;
    margin-top: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4a7abb, #6abaff);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.85rem;
    color: #aaa;
  }

  .idle-text {
    color: #666;
    font-size: 0.9rem;
  }

  .start-section {
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .start-section h3 {
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .form-group {
    margin-bottom: 0.75rem;
  }

  .form-group label {
    display: block;
    font-size: 0.85rem;
    color: #aaa;
    margin-bottom: 0.25rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .form-row .form-group {
    flex: 1;
  }

  .input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: #0f0f1a;
    border: 1px solid #2a2a3e;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 0.9rem;
  }

  .input:focus {
    outline: none;
    border-color: #4a4a7e;
  }

  .textarea {
    resize: vertical;
    font-family: monospace;
    font-size: 0.85rem;
  }

  .jobs-section {
    margin-top: 1rem;
  }

  .jobs-section h3 {
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .job-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .job-card {
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    padding: 1rem;
  }

  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .job-path {
    font-family: monospace;
    font-size: 0.9rem;
    color: #ccc;
  }

  .job-status {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #2a2a3e;
    color: #888;
    text-transform: uppercase;
    font-weight: 600;
  }

  .job-status.completed {
    background: #1a3a1a;
    color: #88ff88;
  }

  .job-status.failed {
    background: #3a1c1c;
    color: #ff8888;
  }

  .job-status.running {
    background: #1a3a1a;
    color: #88ff88;
  }

  .job-status.cancelled {
    background: #3a2e1c;
    color: #ffcc88;
  }

  .job-meta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.8rem;
    color: #666;
  }

  .job-error {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #ff8888;
    background: #2a1a1a;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .btn {
    padding: 0.4rem 0.75rem;
    border: 1px solid #3a3a5e;
    border-radius: 4px;
    background: #2a2a3e;
    color: #ccc;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s, color 0.2s;
  }

  .btn:hover:not(:disabled) {
    background: #3a3a5e;
    color: #fff;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
