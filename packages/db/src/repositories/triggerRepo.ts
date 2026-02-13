/**
 * Trigger Repository — CRUD operations for triggers
 */

import type Database from 'better-sqlite3';
import type { Trigger, CreateTriggerPayload, UpdateTriggerPayload, TriggerActivation } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class TriggerRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateTriggerPayload): Trigger {
    const id = makeId();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO triggers (id, name, enabled, scope, character_id,
        activation, conditions, effects, trigger_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      (data.enabled ?? true) ? 1 : 0,
      data.scope ?? 'global',
      data.characterId ?? null,
      data.activation ?? 'before_generation',
      JSON.stringify(data.conditions ?? []),
      JSON.stringify(data.effects ?? []),
      data.order ?? 0,
      now,
      now,
    );

    return this.get(id)!;
  }

  get(id: string): Trigger | null {
    const row = this.db.prepare('SELECT * FROM triggers WHERE id = ?').get(id) as any;
    return row ? this.rowToTrigger(row) : null;
  }

  update(id: string, data: UpdateTriggerPayload): Trigger | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE triggers SET
        name = ?, enabled = ?, scope = ?, character_id = ?,
        activation = ?, conditions = ?, effects = ?,
        trigger_order = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.name ?? existing.name,
      (data.enabled ?? existing.enabled) ? 1 : 0,
      data.scope ?? existing.scope,
      data.characterId !== undefined ? data.characterId : existing.characterId,
      data.activation ?? existing.activation,
      JSON.stringify(data.conditions ?? existing.conditions),
      JSON.stringify(data.effects ?? existing.effects),
      data.order ?? existing.order,
      now,
      id,
    );

    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM triggers WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /** List triggers for a given activation point and context */
  listForActivation(activation: TriggerActivation, characterId?: string | null): Trigger[] {
    if (characterId) {
      const rows = this.db.prepare(
        `SELECT * FROM triggers
         WHERE activation = ? AND enabled = 1
         AND ((scope = 'global') OR (scope = 'character' AND character_id = ?))
         ORDER BY trigger_order ASC`
      ).all(activation, characterId) as any[];
      return rows.map((r) => this.rowToTrigger(r));
    }

    const rows = this.db.prepare(
      `SELECT * FROM triggers
       WHERE activation = ? AND enabled = 1 AND scope = 'global'
       ORDER BY trigger_order ASC`
    ).all(activation) as any[];
    return rows.map((r) => this.rowToTrigger(r));
  }

  list(opts: { scope?: string; characterId?: string; limit?: number; offset?: number } = {}): {
    triggers: Trigger[];
    total: number;
  } {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    const conditions: string[] = [];
    const params: any[] = [];

    if (opts.scope) {
      conditions.push('scope = ?');
      params.push(opts.scope);
    }
    if (opts.characterId) {
      conditions.push('character_id = ?');
      params.push(opts.characterId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (this.db.prepare(
      `SELECT COUNT(*) as count FROM triggers ${where}`
    ).get(...params) as any).count;

    const rows = this.db.prepare(
      `SELECT * FROM triggers ${where} ORDER BY trigger_order ASC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as any[];

    return {
      triggers: rows.map((r) => this.rowToTrigger(r)),
      total,
    };
  }

  private rowToTrigger(row: any): Trigger {
    return {
      id: row.id,
      name: row.name,
      enabled: !!row.enabled,
      scope: row.scope,
      characterId: row.character_id,
      activation: row.activation,
      conditions: JSON.parse(row.conditions || '[]'),
      effects: JSON.parse(row.effects || '[]'),
      order: row.trigger_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
