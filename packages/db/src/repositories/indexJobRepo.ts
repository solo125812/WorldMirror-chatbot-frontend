/**
 * IndexJobRepo — CRUD for indexing jobs
 */

import type Database from 'better-sqlite3';
import type { IndexJob, IndexJobStatus, IndexMode } from '@chatbot/types';
import { randomUUID } from 'node:crypto';

export class IndexJobRepo {
  constructor(private db: Database.Database) {}

  create(data: { workspacePath: string; mode?: IndexMode }): IndexJob {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO index_jobs (id, workspace_path, status, mode, total_files, processed_files, total_chunks, error, started_at, completed_at, created_at)
      VALUES (?, ?, 'pending', ?, 0, 0, 0, NULL, NULL, NULL, ?)
    `).run(id, data.workspacePath, data.mode ?? 'full', now);
    return this.get(id)!;
  }

  get(id: string): IndexJob | null {
    const row = this.db.prepare('SELECT * FROM index_jobs WHERE id = ?').get(id) as any;
    return row ? this.rowToJob(row) : null;
  }

  getLatest(workspacePath?: string): IndexJob | null {
    let query = 'SELECT * FROM index_jobs';
    const params: unknown[] = [];
    if (workspacePath) {
      query += ' WHERE workspace_path = ?';
      params.push(workspacePath);
    }
    query += ' ORDER BY created_at DESC LIMIT 1';
    const row = this.db.prepare(query).get(...params) as any;
    return row ? this.rowToJob(row) : null;
  }

  getRunning(): IndexJob | null {
    const row = this.db.prepare("SELECT * FROM index_jobs WHERE status IN ('pending', 'running') ORDER BY created_at DESC LIMIT 1").get() as any;
    return row ? this.rowToJob(row) : null;
  }

  updateStatus(id: string, status: IndexJobStatus, error?: string): IndexJob | null {
    const fields: string[] = ['status = ?'];
    const values: unknown[] = [status];

    if (status === 'running') {
      fields.push('started_at = ?');
      values.push(new Date().toISOString());
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      fields.push('completed_at = ?');
      values.push(new Date().toISOString());
    }
    if (error !== undefined) {
      fields.push('error = ?');
      values.push(error);
    }

    values.push(id);
    this.db.prepare(`UPDATE index_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.get(id);
  }

  updateProgress(id: string, data: {
    totalFiles?: number;
    processedFiles?: number;
    totalChunks?: number;
  }): IndexJob | null {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.totalFiles !== undefined) {
      fields.push('total_files = ?');
      values.push(data.totalFiles);
    }
    if (data.processedFiles !== undefined) {
      fields.push('processed_files = ?');
      values.push(data.processedFiles);
    }
    if (data.totalChunks !== undefined) {
      fields.push('total_chunks = ?');
      values.push(data.totalChunks);
    }

    if (fields.length === 0) return this.get(id);

    values.push(id);
    this.db.prepare(`UPDATE index_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM index_jobs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  list(opts: { status?: IndexJobStatus; limit?: number; offset?: number } = {}): {
    items: IndexJob[];
    total: number;
  } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.status) {
      conditions.push('status = ?');
      params.push(opts.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM index_jobs ${where}`).get(...params) as any).count;

    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const rows = this.db.prepare(`SELECT * FROM index_jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];

    return {
      items: rows.map((r) => this.rowToJob(r)),
      total,
    };
  }

  private rowToJob(row: any): IndexJob {
    return {
      id: row.id,
      workspacePath: row.workspace_path,
      status: row.status as IndexJobStatus,
      mode: row.mode as IndexMode,
      totalFiles: row.total_files,
      processedFiles: row.processed_files,
      totalChunks: row.total_chunks,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }
}
