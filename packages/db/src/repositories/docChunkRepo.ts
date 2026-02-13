/**
 * Document Chunk Repository — SQLite-backed CRUD for document chunks
 */

import type Database from 'better-sqlite3';
import type { DocChunk, CreateDocChunkPayload } from '@chatbot/types';
import { makeId, nowIso } from '@chatbot/utils';

export class DocChunkRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateDocChunkPayload): DocChunk {
    const id = makeId();
    const now = nowIso();
    const row = {
      id,
      document_id: data.documentId,
      content: data.content,
      chunk_index: data.chunkIndex,
      token_count: data.tokenCount ?? 0,
      embedding_ref: data.embeddingRef ?? null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      created_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO doc_chunks (id, document_id, content, chunk_index, token_count, embedding_ref, metadata, created_at)
       VALUES (@id, @document_id, @content, @chunk_index, @token_count, @embedding_ref, @metadata, @created_at)`
      )
      .run(row);

    return this.get(id)!;
  }

  /**
   * Batch insert chunks for a document. More efficient than individual inserts.
   */
  createBatch(chunks: CreateDocChunkPayload[]): DocChunk[] {
    const now = nowIso();
    const insert = this.db.prepare(
      `INSERT INTO doc_chunks (id, document_id, content, chunk_index, token_count, embedding_ref, metadata, created_at)
       VALUES (@id, @document_id, @content, @chunk_index, @token_count, @embedding_ref, @metadata, @created_at)`
    );

    const ids: string[] = [];
    const insertAll = this.db.transaction((items: CreateDocChunkPayload[]) => {
      for (const data of items) {
        const id = makeId();
        ids.push(id);
        insert.run({
          id,
          document_id: data.documentId,
          content: data.content,
          chunk_index: data.chunkIndex,
          token_count: data.tokenCount ?? 0,
          embedding_ref: data.embeddingRef ?? null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          created_at: now,
        });
      }
    });

    insertAll(chunks);
    return ids.map((id) => this.get(id)!);
  }

  get(id: string): DocChunk | null {
    const row = this.db
      .prepare('SELECT * FROM doc_chunks WHERE id = ?')
      .get(id) as any;
    return row ? this.rowToChunk(row) : null;
  }

  /**
   * Get all chunks for a document, ordered by chunk_index.
   */
  getByDocument(documentId: string): DocChunk[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM doc_chunks WHERE document_id = ? ORDER BY chunk_index ASC'
      )
      .all(documentId) as any[];
    return rows.map((r) => this.rowToChunk(r));
  }

  /**
   * Delete all chunks for a document.
   */
  deleteByDocument(documentId: string): number {
    const result = this.db
      .prepare('DELETE FROM doc_chunks WHERE document_id = ?')
      .run(documentId);
    return result.changes;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM doc_chunks WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  /**
   * Update embedding reference for a chunk.
   */
  updateEmbeddingRef(id: string, embeddingRef: string): boolean {
    const result = this.db
      .prepare('UPDATE doc_chunks SET embedding_ref = ? WHERE id = ?')
      .run(embeddingRef, id);
    return result.changes > 0;
  }

  /**
   * Search chunks by content (keyword search).
   */
  searchByContent(query: string, opts: {
    documentId?: string;
    limit?: number;
  } = {}): DocChunk[] {
    const limit = opts.limit ?? 20;
    const conditions: string[] = ['content LIKE @query'];
    const params: Record<string, unknown> = { query: `%${query}%` };

    if (opts.documentId) {
      conditions.push('document_id = @document_id');
      params.document_id = opts.documentId;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const rows = this.db
      .prepare(
        `SELECT * FROM doc_chunks ${where} ORDER BY chunk_index ASC LIMIT @limit`
      )
      .all({ ...params, limit }) as any[];

    return rows.map((r) => this.rowToChunk(r));
  }

  private rowToChunk(row: any): DocChunk {
    return {
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      chunkIndex: row.chunk_index,
      tokenCount: row.token_count,
      embeddingRef: row.embedding_ref ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    };
  }
}
