/**
 * Lorebook Repository — CRUD operations for lorebooks
 */

import type Database from 'better-sqlite3';
import type { Lorebook, CreateLorebookPayload, UpdateLorebookPayload } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class LorebookRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateLorebookPayload): Lorebook {
    const id = makeId();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO lorebooks (id, name, description, scan_depth, recursive_scan,
        case_sensitive, match_whole_words, use_group_scoring, budget_tokens,
        min_activations, max_recursion_steps, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description ?? '',
      data.scanDepth ?? 5,
      data.recursiveScan ? 1 : 0,
      data.caseSensitive ? 1 : 0,
      data.matchWholeWords ? 1 : 0,
      data.useGroupScoring ? 1 : 0,
      data.budgetTokens ?? 2048,
      data.minActivations ?? 0,
      data.maxRecursionSteps ?? 3,
      now,
      now,
    );

    return this.get(id)!;
  }

  get(id: string): Lorebook | null {
    const row = this.db.prepare('SELECT * FROM lorebooks WHERE id = ?').get(id) as any;
    return row ? this.rowToLorebook(row) : null;
  }

  getByName(name: string): Lorebook | null {
    const row = this.db.prepare('SELECT * FROM lorebooks WHERE name = ?').get(name) as any;
    return row ? this.rowToLorebook(row) : null;
  }

  update(id: string, data: UpdateLorebookPayload): Lorebook | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE lorebooks SET
        name = ?, description = ?, scan_depth = ?, recursive_scan = ?,
        case_sensitive = ?, match_whole_words = ?, use_group_scoring = ?,
        budget_tokens = ?, min_activations = ?, max_recursion_steps = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      data.name ?? existing.name,
      data.description ?? existing.description,
      data.scanDepth ?? existing.scanDepth,
      (data.recursiveScan ?? existing.recursiveScan) ? 1 : 0,
      (data.caseSensitive ?? existing.caseSensitive) ? 1 : 0,
      (data.matchWholeWords ?? existing.matchWholeWords) ? 1 : 0,
      (data.useGroupScoring ?? existing.useGroupScoring) ? 1 : 0,
      data.budgetTokens ?? existing.budgetTokens,
      data.minActivations ?? existing.minActivations,
      data.maxRecursionSteps ?? existing.maxRecursionSteps,
      now,
      id,
    );

    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM lorebooks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  list(opts: { search?: string; limit?: number; offset?: number } = {}): {
    lorebooks: Lorebook[];
    total: number;
  } {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    let whereClause = '';
    const params: any[] = [];

    if (opts.search) {
      whereClause = 'WHERE name LIKE ? OR description LIKE ?';
      params.push(`%${opts.search}%`, `%${opts.search}%`);
    }

    const total = (this.db.prepare(
      `SELECT COUNT(*) as count FROM lorebooks ${whereClause}`
    ).get(...params) as any).count;

    const rows = this.db.prepare(
      `SELECT * FROM lorebooks ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as any[];

    return {
      lorebooks: rows.map((r) => this.rowToLorebook(r)),
      total,
    };
  }

  private rowToLorebook(row: any): Lorebook {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      scanDepth: row.scan_depth,
      recursiveScan: !!row.recursive_scan,
      caseSensitive: !!row.case_sensitive,
      matchWholeWords: !!row.match_whole_words,
      useGroupScoring: !!row.use_group_scoring,
      budgetTokens: row.budget_tokens,
      minActivations: row.min_activations,
      maxRecursionSteps: row.max_recursion_steps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
