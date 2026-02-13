/**
 * CodeChunkRepo — CRUD for code chunks used by the indexer
 */

import type Database from 'better-sqlite3';
import type { CodeChunk, CreateCodeChunkPayload } from '@chatbot/types';
import { randomUUID } from 'node:crypto';

export class CodeChunkRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateCodeChunkPayload): CodeChunk {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO code_chunks (id, document_id, workspace_path, file_path, language, content, line_start, line_end, hash, file_hash, embedding_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(
      id,
      data.documentId,
      data.workspacePath,
      data.filePath,
      data.language,
      data.content,
      data.lineStart,
      data.lineEnd,
      data.hash,
      data.fileHash,
      now,
    );
    return this.get(id)!;
  }

  createBatch(chunks: CreateCodeChunkPayload[]): CodeChunk[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO code_chunks (id, document_id, workspace_path, file_path, language, content, line_start, line_end, hash, file_hash, embedding_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `);

    const ids: string[] = [];
    const insertAll = this.db.transaction((items: CreateCodeChunkPayload[]) => {
      for (const chunk of items) {
        const id = randomUUID();
        ids.push(id);
        stmt.run(
          id,
          chunk.documentId,
          chunk.workspacePath,
          chunk.filePath,
          chunk.language,
          chunk.content,
          chunk.lineStart,
          chunk.lineEnd,
          chunk.hash,
          chunk.fileHash,
          now,
        );
      }
    });

    insertAll(chunks);
    return ids.map((id) => this.get(id)!);
  }

  get(id: string): CodeChunk | null {
    const row = this.db.prepare('SELECT * FROM code_chunks WHERE id = ?').get(id) as any;
    return row ? this.rowToChunk(row) : null;
  }

  getByFilePath(filePath: string): CodeChunk[] {
    const rows = this.db.prepare('SELECT * FROM code_chunks WHERE file_path = ? ORDER BY line_start ASC').all(filePath) as any[];
    return rows.map((r) => this.rowToChunk(r));
  }

  getByDocument(documentId: string): CodeChunk[] {
    const rows = this.db.prepare('SELECT * FROM code_chunks WHERE document_id = ? ORDER BY line_start ASC').all(documentId) as any[];
    return rows.map((r) => this.rowToChunk(r));
  }

  deleteByDocument(documentId: string): number {
    const result = this.db.prepare('DELETE FROM code_chunks WHERE document_id = ?').run(documentId);
    return result.changes;
  }

  deleteByFilePath(filePath: string, workspacePath?: string): number {
    if (workspacePath) {
      const result = this.db.prepare('DELETE FROM code_chunks WHERE file_path = ? AND workspace_path = ?').run(filePath, workspacePath);
      return result.changes;
    }
    const result = this.db.prepare('DELETE FROM code_chunks WHERE file_path = ?').run(filePath);
    return result.changes;
  }

  deleteByWorkspace(workspacePath: string): number {
    const result = this.db.prepare('DELETE FROM code_chunks WHERE workspace_path = ?').run(workspacePath);
    return result.changes;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM code_chunks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  updateEmbeddingRef(id: string, embeddingRef: string): boolean {
    const result = this.db.prepare('UPDATE code_chunks SET embedding_ref = ? WHERE id = ?').run(embeddingRef, id);
    return result.changes > 0;
  }

  searchByContent(query: string, opts: {
    language?: string;
    limit?: number;
  } = {}): CodeChunk[] {
    const conditions: string[] = ['content LIKE ?'];
    const params: unknown[] = [`%${query}%`];

    if (opts.language) {
      conditions.push('language = ?');
      params.push(opts.language);
    }

    const limit = opts.limit ?? 20;
    const where = conditions.join(' AND ');
    const rows = this.db.prepare(`SELECT * FROM code_chunks WHERE ${where} ORDER BY file_path ASC LIMIT ?`).all(...params, limit) as any[];
    return rows.map((r) => this.rowToChunk(r));
  }

  /** Get all unique file paths with their hashes for incremental updates */
  getFileHashes(workspacePath?: string): Map<string, string> {
    const rows = workspacePath
      ? this.db.prepare("SELECT DISTINCT file_path, file_hash FROM code_chunks WHERE workspace_path = ? AND file_hash != ''").all(workspacePath) as any[]
      : this.db.prepare("SELECT DISTINCT file_path, file_hash FROM code_chunks WHERE file_hash != ''").all() as any[];
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.file_path, row.file_hash);
    }
    return map;
  }

  private rowToChunk(row: any): CodeChunk {
    return {
      id: row.id,
      documentId: row.document_id,
      workspacePath: row.workspace_path ?? '',
      filePath: row.file_path,
      language: row.language,
      content: row.content,
      lineStart: row.line_start,
      lineEnd: row.line_end,
      hash: row.hash,
      fileHash: row.file_hash ?? '',
      embeddingRef: row.embedding_ref,
      createdAt: row.created_at,
    };
  }
}
