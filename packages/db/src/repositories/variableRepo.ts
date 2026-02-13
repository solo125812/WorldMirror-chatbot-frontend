/**
 * Variable Repository — CRUD for global and chat-scoped variables
 */

import type Database from 'better-sqlite3';
import type { Variable, VariableScope } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class VariableRepo {
  constructor(private db: Database.Database) {}

  get(scope: VariableScope, key: string, chatId?: string | null): Variable | null {
    const row = scope === 'global'
      ? this.db.prepare(
          'SELECT * FROM variables WHERE scope = ? AND key = ? AND chat_id IS NULL'
        ).get('global', key) as any
      : this.db.prepare(
          'SELECT * FROM variables WHERE scope = ? AND key = ? AND chat_id = ?'
        ).get('chat', key, chatId ?? null) as any;
    return row ? this.rowToVariable(row) : null;
  }

  getValue(scope: VariableScope, key: string, chatId?: string | null): string | null {
    const v = this.get(scope, key, chatId);
    return v ? v.value : null;
  }

  set(scope: VariableScope, key: string, value: string, chatId?: string | null): Variable {
    const now = new Date().toISOString();
    const existing = this.get(scope, key, chatId);

    if (existing) {
      this.db.prepare(
        'UPDATE variables SET value = ?, updated_at = ? WHERE id = ?'
      ).run(value, now, existing.id);
      return { ...existing, value, updatedAt: now };
    }

    const id = makeId();
    this.db.prepare(`
      INSERT INTO variables (id, scope, chat_id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, scope, scope === 'chat' ? (chatId ?? null) : null, key, value, now, now);

    return this.rowToVariable(
      this.db.prepare('SELECT * FROM variables WHERE id = ?').get(id) as any
    );
  }

  delete(scope: VariableScope, key: string, chatId?: string | null): boolean {
    const result = scope === 'global'
      ? this.db.prepare(
          'DELETE FROM variables WHERE scope = ? AND key = ? AND chat_id IS NULL'
        ).run('global', key)
      : this.db.prepare(
          'DELETE FROM variables WHERE scope = ? AND key = ? AND chat_id = ?'
        ).run('chat', key, chatId ?? null);
    return result.changes > 0;
  }

  listGlobal(): Variable[] {
    const rows = this.db.prepare(
      'SELECT * FROM variables WHERE scope = ? ORDER BY key ASC'
    ).all('global') as any[];
    return rows.map((r) => this.rowToVariable(r));
  }

  listChat(chatId: string): Variable[] {
    const rows = this.db.prepare(
      'SELECT * FROM variables WHERE scope = ? AND chat_id = ? ORDER BY key ASC'
    ).all('chat', chatId) as any[];
    return rows.map((r) => this.rowToVariable(r));
  }

  /** Increment or decrement a numeric variable */
  increment(scope: VariableScope, key: string, amount: number = 1, chatId?: string | null): Variable {
    const existing = this.get(scope, key, chatId);
    const current = existing ? parseFloat(existing.value) || 0 : 0;
    const newValue = String(current + amount);
    return this.set(scope, key, newValue, chatId);
  }

  private rowToVariable(row: any): Variable {
    return {
      id: row.id,
      scope: row.scope,
      chatId: row.chat_id,
      key: row.key,
      value: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
