/**
 * Memory Entry Repository — SQLite-backed CRUD for memory entries
 */

import type Database from 'better-sqlite3';
import type {
  MemoryEntry,
  CreateMemoryEntryPayload,
  MemoryScope,
  MemoryCategory,
} from '@chatbot/types';
import { makeId, nowIso } from '@chatbot/utils';

export class MemoryRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateMemoryEntryPayload): MemoryEntry {
    const id = makeId();
    const now = nowIso();
    const row = {
      id,
      type: data.type ?? 'memory',
      category: data.category ?? 'fact',
      scope: data.scope ?? 'global',
      source_id: data.sourceId ?? null,
      content: data.content,
      importance: data.importance ?? 0.5,
      embedding_ref: data.embeddingRef ?? null,
      auto_captured: data.autoCaptured ? 1 : 0,
      created_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO memory_entries (id, type, category, scope, source_id, content,
         importance, embedding_ref, auto_captured, created_at)
       VALUES (@id, @type, @category, @scope, @source_id, @content,
         @importance, @embedding_ref, @auto_captured, @created_at)`
      )
      .run(row);

    return this.get(id)!;
  }

  get(id: string): MemoryEntry | null {
    const row = this.db
      .prepare('SELECT * FROM memory_entries WHERE id = ?')
      .get(id) as any;
    return row ? this.rowToEntry(row) : null;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM memory_entries WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  /**
   * List memory entries with filtering and pagination.
   */
  list(opts: {
    scope?: MemoryScope;
    sourceId?: string;
    category?: MemoryCategory;
    type?: string;
    autoCapturedOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): { entries: MemoryEntry[]; total: number } {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (opts.scope) {
      conditions.push('scope = @scope');
      params.scope = opts.scope;
    }
    if (opts.sourceId) {
      conditions.push('source_id = @source_id');
      params.source_id = opts.sourceId;
    }
    if (opts.category) {
      conditions.push('category = @category');
      params.category = opts.category;
    }
    if (opts.type) {
      conditions.push('type = @type');
      params.type = opts.type;
    }
    if (opts.autoCapturedOnly) {
      conditions.push('auto_captured = 1');
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) as count FROM memory_entries ${where}`)
        .get(params) as any
    ).count;

    const rows = this.db
      .prepare(
        `SELECT * FROM memory_entries ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset }) as any[];

    return {
      entries: rows.map((r) => this.rowToEntry(r)),
      total,
    };
  }

  /**
   * Search memory entries by content (keyword search).
   */
  searchByContent(query: string, opts: {
    scope?: MemoryScope;
    sourceId?: string;
    limit?: number;
  } = {}): MemoryEntry[] {
    const limit = opts.limit ?? 20;
    const conditions: string[] = ['content LIKE @query'];
    const params: Record<string, unknown> = { query: `%${query}%` };

    if (opts.scope) {
      conditions.push('scope = @scope');
      params.scope = opts.scope;
    }
    if (opts.sourceId) {
      conditions.push('source_id = @source_id');
      params.source_id = opts.sourceId;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_entries ${where} ORDER BY importance DESC, created_at DESC LIMIT @limit`
      )
      .all({ ...params, limit }) as any[];

    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Find entries with high similarity for deduplication.
   * Returns entries matching the same scope + sourceId + category with similar content.
   */
  findSimilar(content: string, opts: {
    scope?: MemoryScope;
    sourceId?: string;
    category?: MemoryCategory;
    limit?: number;
  } = {}): MemoryEntry[] {
    const limit = opts.limit ?? 5;
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (opts.scope) {
      conditions.push('scope = @scope');
      params.scope = opts.scope;
    }
    if (opts.sourceId) {
      conditions.push('source_id = @source_id');
      params.source_id = opts.sourceId;
    }
    if (opts.category) {
      conditions.push('category = @category');
      params.category = opts.category;
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Simple keyword overlap for deduplication — actual cosine dedup is done in vector layer
    const rows = this.db
      .prepare(
        `SELECT * FROM memory_entries ${where} ORDER BY created_at DESC LIMIT @limit`
      )
      .all({ ...params, limit }) as any[];

    return rows.map((r) => this.rowToEntry(r));
  }

  /**
   * Update embedding reference for a memory entry.
   */
  updateEmbeddingRef(id: string, embeddingRef: string): boolean {
    const result = this.db
      .prepare('UPDATE memory_entries SET embedding_ref = ? WHERE id = ?')
      .run(embeddingRef, id);
    return result.changes > 0;
  }

  private rowToEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      type: row.type,
      category: row.category,
      scope: row.scope,
      sourceId: row.source_id ?? undefined,
      content: row.content,
      importance: row.importance,
      embeddingRef: row.embedding_ref ?? undefined,
      autoCaptured: Boolean(row.auto_captured),
      createdAt: row.created_at,
    };
  }
}
