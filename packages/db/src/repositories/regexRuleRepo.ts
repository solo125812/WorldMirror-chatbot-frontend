/**
 * DB-backed Regex Rule Repository
 * Phase 4: extends the Phase 2 inline regex rules with persistent, per-character rules
 */

import type Database from 'better-sqlite3';
import type { DbRegexRule, CreateDbRegexRulePayload, UpdateDbRegexRulePayload } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class RegexRuleRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateDbRegexRulePayload): DbRegexRule {
    const id = makeId();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO regex_rules (id, name, enabled, scope, character_id,
        find_regex, replace_string, placement, flags, rule_order,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      (data.enabled ?? true) ? 1 : 0,
      data.scope ?? 'global',
      data.characterId ?? null,
      data.findRegex,
      data.replaceString ?? '',
      JSON.stringify(data.placement ?? ['user_input']),
      data.flags ?? 'g',
      data.order ?? 0,
      now,
      now,
    );

    return this.get(id)!;
  }

  get(id: string): DbRegexRule | null {
    const row = this.db.prepare('SELECT * FROM regex_rules WHERE id = ?').get(id) as any;
    return row ? this.rowToRule(row) : null;
  }

  update(id: string, data: UpdateDbRegexRulePayload): DbRegexRule | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE regex_rules SET
        name = ?, enabled = ?, scope = ?, character_id = ?,
        find_regex = ?, replace_string = ?, placement = ?, flags = ?,
        rule_order = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.name ?? existing.name,
      (data.enabled ?? existing.enabled) ? 1 : 0,
      data.scope ?? existing.scope,
      data.characterId !== undefined ? data.characterId : existing.characterId,
      data.findRegex ?? existing.findRegex,
      data.replaceString ?? existing.replaceString,
      JSON.stringify(data.placement ?? existing.placement),
      data.flags ?? existing.flags,
      data.order ?? existing.order,
      now,
      id,
    );

    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM regex_rules WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /** List rules for a given context (global + optional character) */
  listForContext(characterId?: string | null): DbRegexRule[] {
    if (characterId) {
      const rows = this.db.prepare(
        `SELECT * FROM regex_rules
         WHERE (scope = 'global') OR (scope = 'character' AND character_id = ?)
         ORDER BY rule_order ASC`
      ).all(characterId) as any[];
      return rows.map((r) => this.rowToRule(r));
    }

    const rows = this.db.prepare(
      "SELECT * FROM regex_rules WHERE scope = 'global' ORDER BY rule_order ASC"
    ).all() as any[];
    return rows.map((r) => this.rowToRule(r));
  }

  list(opts: { scope?: string; characterId?: string; limit?: number; offset?: number } = {}): {
    rules: DbRegexRule[];
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
      `SELECT COUNT(*) as count FROM regex_rules ${where}`
    ).get(...params) as any).count;

    const rows = this.db.prepare(
      `SELECT * FROM regex_rules ${where} ORDER BY rule_order ASC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as any[];

    return {
      rules: rows.map((r) => this.rowToRule(r)),
      total,
    };
  }

  private rowToRule(row: any): DbRegexRule {
    return {
      id: row.id,
      name: row.name,
      enabled: !!row.enabled,
      scope: row.scope,
      characterId: row.character_id,
      findRegex: row.find_regex,
      replaceString: row.replace_string,
      placement: JSON.parse(row.placement || '[]'),
      flags: row.flags,
      order: row.rule_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
