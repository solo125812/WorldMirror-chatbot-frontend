/**
 * Indexing coordinator — §10 Codebase Indexing Pipeline
 *
 * Orchestrates scanning, chunking, embedding, and storage
 * for codebase indexing jobs.
 */

import type { IndexJob, IndexStatus, CodeSearchResult, CodeSearchRequest } from '@chatbot/types';
import type { CodeChunkRepo, IndexJobRepo } from '@chatbot/db';
import type { EmbeddingProvider, VectorStore } from '@chatbot/memory';
import { scanWorkspace, loadIgnorePatterns } from './scanner.js';
import { chunkFile } from './chunker.js';
import { logger } from '@chatbot/utils';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export interface IndexerConfig {
  /** Max files to process per batch */
  batchSize: number;
}

const DEFAULT_CONFIG: IndexerConfig = {
  batchSize: 50,
};

/**
 * CodeIndexer manages the full indexing lifecycle:
 * scan → chunk → embed → store
 */
export class CodeIndexer {
  private currentJob: IndexJob | null = null;
  private abortController: AbortController | null = null;

  constructor(
    private codeChunkRepo: CodeChunkRepo,
    private indexJobRepo: IndexJobRepo,
    private embeddingProvider: EmbeddingProvider,
    private vectorStore: VectorStore,
    private config: IndexerConfig = DEFAULT_CONFIG,
  ) {}

  /**
   * Start a new indexing job for a workspace path.
   */
  async startJob(workspacePath: string, opts?: {
    mode?: 'full' | 'incremental';
    ignorePatterns?: string[];
  }): Promise<IndexJob> {
    // Check if a job is already running
    const running = this.indexJobRepo.getRunning();
    if (running) {
      throw new Error(`An indexing job is already running (${running.id})`);
    }

    const mode = opts?.mode ?? 'full';
    const job = this.indexJobRepo.create({ workspacePath, mode });
    this.currentJob = job;

    // Run indexing in background
    this.runJob(job.id, workspacePath, mode, opts?.ignorePatterns).catch((error) => {
      logger.error('Indexing job failed', { jobId: job.id, error: error instanceof Error ? error.message : String(error) });
      this.indexJobRepo.updateStatus(job.id, 'failed', error instanceof Error ? error.message : String(error));
    });

    return job;
  }

  /**
   * Stop the currently running job.
   */
  stopJob(): boolean {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      if (this.currentJob) {
        this.indexJobRepo.updateStatus(this.currentJob.id, 'cancelled');
        this.currentJob = null;
      }
      return true;
    }
    return false;
  }

  /**
   * Get current indexing status.
   */
  getStatus(): IndexStatus {
    const job = this.currentJob ?? this.indexJobRepo.getLatest();
    if (!job) {
      return { jobId: null, status: 'idle', workspacePath: null, progress: null };
    }

    // Refresh from DB
    const fresh = this.indexJobRepo.get(job.id);
    if (!fresh) {
      return { jobId: null, status: 'idle', workspacePath: null, progress: null };
    }

    return {
      jobId: fresh.id,
      status: fresh.status,
      workspacePath: fresh.workspacePath,
      progress: {
        totalFiles: fresh.totalFiles,
        processedFiles: fresh.processedFiles,
        totalChunks: fresh.totalChunks,
      },
    };
  }

  /**
   * Search indexed code using vector similarity.
   */
  async search(request: CodeSearchRequest): Promise<CodeSearchResult[]> {
    const topK = request.topK ?? 10;

    // Generate embedding for query
    const queryResult = await this.embeddingProvider.embed([request.query]);
    const queryEmbedding = queryResult.embeddings[0] ?? [];

    // Search vector store
    const filter: Record<string, unknown> = { type: 'code' };
    if (request.workspacePath) {
      filter.workspacePath = request.workspacePath;
    }
    if (request.language) {
      filter.language = request.language;
    }

    const vectorResults = await this.vectorStore.search(queryEmbedding, topK * 2, filter);

    // Hydrate with chunk data
    const results: CodeSearchResult[] = [];
    for (const vr of vectorResults) {
      const chunkId = vr.metadata?.chunkId as string | undefined;
      if (!chunkId) continue;

      const chunk = this.codeChunkRepo.get(chunkId);
      if (!chunk) continue;

      // Apply language filter if specified
      if (request.language && chunk.language !== request.language) continue;

      results.push({
        chunkId: chunk.id,
        filePath: chunk.filePath,
        language: chunk.language,
        content: chunk.content,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        score: vr.score,
      });

      if (results.length >= topK) break;
    }

    return results;
  }

  /**
   * Run the indexing pipeline for a job.
   */
  private async runJob(
    jobId: string,
    workspacePath: string,
    mode: 'full' | 'incremental',
    userIgnorePatterns?: string[],
  ): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Mark job as running
    this.indexJobRepo.updateStatus(jobId, 'running');

    // Full reindex: clear previous chunks/vectors for this workspace
    if (mode === 'full') {
      this.codeChunkRepo.deleteByWorkspace(workspacePath);
      this.vectorStore.deleteByMetadata('workspacePath', workspacePath);
    }

    // Step 1: Scan workspace
    const ignorePatterns = loadIgnorePatterns(workspacePath, userIgnorePatterns);
    const files = scanWorkspace(workspacePath, ignorePatterns);

    this.indexJobRepo.updateProgress(jobId, { totalFiles: files.length });

    // Step 2: For incremental mode, filter to changed files only
    let filesToProcess = files;
    if (mode === 'incremental') {
      const existingHashes = this.codeChunkRepo.getFileHashes(workspacePath);
      filesToProcess = files.filter((f) => {
        const existing = existingHashes.get(f.relativePath);
        return !existing || existing !== f.hash;
      });
      logger.debug(`Incremental mode: ${filesToProcess.length}/${files.length} files changed`);
    }

    let processedFiles = 0;
    let totalChunks = 0;
    const documentId = randomUUID();

    // Step 3: Process files in batches
    for (let i = 0; i < filesToProcess.length; i += this.config.batchSize) {
      if (signal.aborted) break;

      const batch = filesToProcess.slice(i, i + this.config.batchSize);

      for (const file of batch) {
        if (signal.aborted) break;

        try {
          const content = readFileSync(file.path, 'utf-8');

          // Remove old chunks for this file (if incremental)
          if (mode === 'incremental') {
            const codeKey = `${workspacePath}::${file.relativePath}`;
            this.vectorStore.deleteByMetadata('codeKey', codeKey);
            this.codeChunkRepo.deleteByFilePath(file.relativePath, workspacePath);
          }

          // Chunk the file
          const chunks = chunkFile(
            content,
            file.relativePath,
            file.language,
            documentId,
            workspacePath,
            file.hash,
          );

          if (chunks.length > 0) {
            // Store chunks in DB
            const stored = this.codeChunkRepo.createBatch(chunks);

            // Generate embeddings and store in vector store
            for (const chunk of stored) {
              try {
                const embedResult = await this.embeddingProvider.embed([chunk.content]);
                const embedding = embedResult.embeddings[0];
                if (!embedding) {
                  logger.warn(`No embedding returned for chunk ${chunk.id}`);
                  continue;
                }
                const codeKey = `${workspacePath}::${chunk.filePath}`;
                this.vectorStore.insert(chunk.id, embedding, {
                  type: 'code',
                  chunkId: chunk.id,
                  filePath: chunk.filePath,
                  language: chunk.language,
                  lineStart: chunk.lineStart,
                  lineEnd: chunk.lineEnd,
                  workspacePath,
                  codeKey,
                });
                this.codeChunkRepo.updateEmbeddingRef(chunk.id, chunk.id);
              } catch (e) {
                logger.warn(`Failed to embed chunk ${chunk.id}`, {
                  error: e instanceof Error ? e.message : String(e),
                });
              }
            }

            totalChunks += stored.length;
          }

          processedFiles++;
        } catch (e) {
          logger.warn(`Failed to process file ${file.path}`, {
            error: e instanceof Error ? e.message : String(e),
          });
          processedFiles++;
        }
      }

      // Update progress
      this.indexJobRepo.updateProgress(jobId, { processedFiles, totalChunks });
    }

    // Flush vector store
    this.vectorStore.flush();

    // Mark job as completed
    if (!signal.aborted) {
      this.indexJobRepo.updateStatus(jobId, 'completed');
      this.indexJobRepo.updateProgress(jobId, { processedFiles, totalChunks });
    }

    this.currentJob = null;
    this.abortController = null;

    logger.info(`Indexing complete: ${processedFiles} files, ${totalChunks} chunks`, { jobId });
  }
}
