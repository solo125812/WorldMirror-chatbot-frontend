/**
 * Document Repository — SQLite-backed CRUD for ingested documents
 */

import type Database from 'better-sqlite3';
import type { Document, CreateDocumentPayload } from '@chatbot/types';
import { makeId, nowIso } from '@chatbot/utils';

export class DocumentRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateDocumentPayload): Document {
    const id = makeId();
    const now = nowIso();
    const row = {
      id,
      title: data.title,
      source_type: data.sourceType,
      source_uri: data.sourceUri ?? null,
      mime_type: data.mimeType ?? null,
      size_bytes: data.sizeBytes ?? 0,
      chunk_count: 0,
      created_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO documents (id, title, source_type, source_uri, mime_type, size_bytes, chunk_count, created_at)
       VALUES (@id, @title, @source_type, @source_uri, @mime_type, @size_bytes, @chunk_count, @created_at)`
      )
      .run(row);

    return this.get(id)!;
  }

  get(id: string): Document | null {
    const row = this.db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(id) as any;
    return row ? this.rowToDocument(row) : null;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM documents WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  updateChunkCount(id: string, chunkCount: number): boolean {
    const result = this.db
      .prepare('UPDATE documents SET chunk_count = ? WHERE id = ?')
      .run(chunkCount, id);
    return result.changes > 0;
  }

  list(opts: {
    sourceType?: string;
    limit?: number;
    offset?: number;
  } = {}): { documents: Document[]; total: number } {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (opts.sourceType) {
      conditions.push('source_type = @source_type');
      params.source_type = opts.sourceType;
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) as count FROM documents ${where}`)
        .get(params) as any
    ).count;

    const rows = this.db
      .prepare(
        `SELECT * FROM documents ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset }) as any[];

    return {
      documents: rows.map((r) => this.rowToDocument(r)),
      total,
    };
  }

  private rowToDocument(row: any): Document {
    return {
      id: row.id,
      title: row.title,
      sourceType: row.source_type,
      sourceUri: row.source_uri ?? undefined,
      mimeType: row.mime_type ?? undefined,
      sizeBytes: row.size_bytes,
      chunkCount: row.chunk_count,
      createdAt: row.created_at,
    };
  }
}
