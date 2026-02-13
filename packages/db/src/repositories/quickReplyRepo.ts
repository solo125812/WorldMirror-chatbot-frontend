/**
 * Quick Reply Repository
 * Phase 7 — Week 22
 */

import type Database from 'better-sqlite3';
import type { QuickReplySet, QuickReplyItem } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class QuickReplySetRepo {
  constructor(private db: Database.Database) {}

  create(name: string, scope: 'global' | 'character', characterId?: string): QuickReplySet {
    const id = makeId();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO quick_reply_sets (id, name, scope, character_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, name, scope, characterId ?? null, now, now);

    return { id, name, scope, characterId, items: [], createdAt: now, updatedAt: now };
  }

  list(opts?: { scope?: string; characterId?: string }): QuickReplySet[] {
    let sql = 'SELECT * FROM quick_reply_sets WHERE 1=1';
    const params: any[] = [];

    if (opts?.scope) {
      sql += ' AND scope = ?';
      params.push(opts.scope);
    }
    if (opts?.characterId) {
      sql += ' AND character_id = ?';
      params.push(opts.characterId);
    }

    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      scope: row.scope,
      characterId: row.character_id ?? undefined,
      items: this.getItems(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  get(id: string): QuickReplySet | null {
    const row = this.db
      .prepare('SELECT * FROM quick_reply_sets WHERE id = ?')
      .get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      scope: row.scope,
      characterId: row.character_id ?? undefined,
      items: this.getItems(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  update(id: string, data: { name?: string }): boolean {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = datetime('now')");
    params.push(id);

    const result = this.db
      .prepare(`UPDATE quick_reply_sets SET ${fields.join(', ')} WHERE id = ?`)
      .run(...params);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM quick_reply_sets WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  private getItems(setId: string): QuickReplyItem[] {
    const rows = this.db
      .prepare('SELECT * FROM quick_reply_items WHERE set_id = ? ORDER BY sort_order ASC')
      .all(setId) as any[];

    return rows.map(this.rowToItem);
  }

  private rowToItem(row: any): QuickReplyItem {
    return {
      id: row.id,
      setId: row.set_id,
      label: row.label,
      command: row.command,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class QuickReplyItemRepo {
  constructor(private db: Database.Database) {}

  create(setId: string, label: string, command: string, sortOrder?: number): QuickReplyItem {
    const id = makeId();
    const now = new Date().toISOString();
    const order = sortOrder ?? this.getNextSortOrder(setId);

    this.db
      .prepare(
        `INSERT INTO quick_reply_items (id, set_id, label, command, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, setId, label, command, order, now, now);

    // Touch the parent set's updated_at
    this.db
      .prepare("UPDATE quick_reply_sets SET updated_at = datetime('now') WHERE id = ?")
      .run(setId);

    return { id, setId, label, command, sortOrder: order, createdAt: now, updatedAt: now };
  }

  update(id: string, data: { label?: string; command?: string; sortOrder?: number }): boolean {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.label !== undefined) {
      fields.push('label = ?');
      params.push(data.label);
    }
    if (data.command !== undefined) {
      fields.push('command = ?');
      params.push(data.command);
    }
    if (data.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      params.push(data.sortOrder);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = datetime('now')");
    params.push(id);

    const result = this.db
      .prepare(`UPDATE quick_reply_items SET ${fields.join(', ')} WHERE id = ?`)
      .run(...params);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM quick_reply_items WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  reorder(setId: string, itemIds: string[]): void {
    const stmt = this.db.prepare(
      'UPDATE quick_reply_items SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ? AND set_id = ?',
    );

    const tx = this.db.transaction((ids: string[]) => {
      ids.forEach((itemId, idx) => {
        stmt.run(idx, itemId, setId);
      });
    });

    tx(itemIds);
  }

  private getNextSortOrder(setId: string): number {
    const row = this.db
      .prepare('SELECT MAX(sort_order) as max_order FROM quick_reply_items WHERE set_id = ?')
      .get(setId) as any;
    return (row?.max_order ?? -1) + 1;
  }
}
