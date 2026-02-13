/**
 * Lorebook Binding Repository — manages lorebook-to-scope associations
 */

import type Database from 'better-sqlite3';
import type { LorebookBinding, CreateLorebookBindingPayload, LorebookBindingScope } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class LorebookBindingRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateLorebookBindingPayload): LorebookBinding {
    const id = makeId();

    this.db.prepare(`
      INSERT INTO lorebook_bindings (id, lorebook_id, scope, source_id, priority)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      data.lorebookId,
      data.scope,
      data.sourceId ?? null,
      data.priority ?? 0,
    );

    return this.get(id)!;
  }

  get(id: string): LorebookBinding | null {
    const row = this.db.prepare('SELECT * FROM lorebook_bindings WHERE id = ?').get(id) as any;
    return row ? this.rowToBinding(row) : null;
  }

  listByScope(scope: LorebookBindingScope, sourceId?: string | null): LorebookBinding[] {
    if (scope === 'global') {
      const rows = this.db.prepare(
        'SELECT * FROM lorebook_bindings WHERE scope = ? ORDER BY priority ASC'
      ).all('global') as any[];
      return rows.map((r) => this.rowToBinding(r));
    }
    const rows = this.db.prepare(
      'SELECT * FROM lorebook_bindings WHERE scope = ? AND source_id = ? ORDER BY priority ASC'
    ).all(scope, sourceId ?? null) as any[];
    return rows.map((r) => this.rowToBinding(r));
  }

  /** Get all bindings relevant for a given character + chat context */
  listForContext(characterId?: string | null, chatId?: string | null): LorebookBinding[] {
    const bindings: LorebookBinding[] = [];

    // Global bindings always included
    bindings.push(...this.listByScope('global'));

    // Character bindings
    if (characterId) {
      bindings.push(...this.listByScope('character', characterId));
    }

    // Chat bindings
    if (chatId) {
      bindings.push(...this.listByScope('chat', chatId));
    }

    // Sort by priority
    bindings.sort((a, b) => a.priority - b.priority);
    return bindings;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM lorebook_bindings WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteByLorebook(lorebookId: string): number {
    const result = this.db.prepare('DELETE FROM lorebook_bindings WHERE lorebook_id = ?').run(lorebookId);
    return result.changes;
  }

  private rowToBinding(row: any): LorebookBinding {
    return {
      id: row.id,
      lorebookId: row.lorebook_id,
      scope: row.scope,
      sourceId: row.source_id,
      priority: row.priority,
    };
  }
}
