/**
 * Integration tests — CodeIndexer pipeline
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestDatabase, resetDatabase, CodeChunkRepo, IndexJobRepo } from '@chatbot/db';
import { createEmbeddingProvider, InMemoryVectorStore } from '@chatbot/memory';
import { CodeIndexer } from '@chatbot/indexer';

function waitForJob(indexJobRepo: IndexJobRepo, id: string, timeoutMs: number = 5000): Promise<void> {
  const start = Date.now();
  return new Promise((resolvePromise, reject) => {
    const tick = () => {
      const job = indexJobRepo.get(id);
      if (!job) return reject(new Error('Job not found'));
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        if (job.status !== 'completed') {
          return reject(new Error(`Job ended with status ${job.status}`));
        }
        return resolvePromise();
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Timed out waiting for job completion'));
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

describe('CodeIndexer pipeline', () => {
  let workspaceDir: string;
  let dbClient: ReturnType<typeof createTestDatabase>;
  let codeChunkRepo: CodeChunkRepo;
  let indexJobRepo: IndexJobRepo;
  let vectorStore: InMemoryVectorStore;
  let embeddingProvider: ReturnType<typeof createEmbeddingProvider>;
  let indexer: CodeIndexer;

  beforeAll(() => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../../apps/server/migrations');

    dbClient = createTestDatabase(migrationsDir);
    codeChunkRepo = new CodeChunkRepo(dbClient.db);
    indexJobRepo = new IndexJobRepo(dbClient.db);

    embeddingProvider = createEmbeddingProvider({
      provider: 'local',
      model: 'local-fallback',
      dimensions: 8,
    });
    vectorStore = new InMemoryVectorStore({ dimensions: 8 });
    indexer = new CodeIndexer(codeChunkRepo, indexJobRepo, embeddingProvider, vectorStore, { batchSize: 10 });

    workspaceDir = mkdtempSync(join(tmpdir(), 'wm-indexer-'));
    const srcDir = join(workspaceDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    const content = [
      'export function alpha() {',
      '  return 1;',
      '}',
      '',
      'export function beta() {',
      '  return 2;',
      '}',
      '',
      'export const gamma = () => 3;',
      'export const delta = () => 4;',
    ].join('\n');
    writeFileSync(join(srcDir, 'example.ts'), content, 'utf-8');
  });

  afterAll(() => {
    try {
      rmSync(workspaceDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    try {
      dbClient.close();
    } catch {
      // ignore cleanup errors
    }
    resetDatabase();
  });

  it('indexes a workspace and returns search results', async () => {
    const job = await indexer.startJob(workspaceDir, { mode: 'full' });
    await waitForJob(indexJobRepo, job.id);

    const chunks = codeChunkRepo.getByFilePath('src/example.ts');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.embeddingRef).toBeTruthy();
    expect(vectorStore.count()).toBeGreaterThan(0);

    const results = await indexer.search({ query: 'function alpha', workspacePath: workspaceDir, topK: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.filePath).toBe('src/example.ts');
  });

  it('skips unchanged files in incremental mode', async () => {
    const job = await indexer.startJob(workspaceDir, { mode: 'incremental' });
    await waitForJob(indexJobRepo, job.id);

    const record = indexJobRepo.get(job.id)!;
    expect(record.processedFiles).toBe(0);
  });
});
