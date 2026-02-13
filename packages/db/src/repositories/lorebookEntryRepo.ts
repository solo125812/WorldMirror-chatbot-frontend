/**
 * Lorebook Entry Repository — CRUD operations for lorebook entries
 */

import type Database from 'better-sqlite3';
import type { LorebookEntry, CreateLorebookEntryPayload, UpdateLorebookEntryPayload } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class LorebookEntryRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateLorebookEntryPayload): LorebookEntry {
    const id = makeId();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO lorebook_entries (id, lorebook_id, keys, secondary_keys, content,
        enabled, position, insertion_order, case_sensitive, match_whole_words,
        regex, constant, selective, exclude_recursion, group_id,
        cooldown_turns, delay_turns, sticky_turns, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.lorebookId,
      JSON.stringify(data.keys ?? []),
      JSON.stringify(data.secondaryKeys ?? []),
      data.content ?? '',
      (data.enabled ?? true) ? 1 : 0,
      data.position ?? 'before_persona',
      data.insertionOrder ?? 100,
      (data.caseSensitive ?? false) ? 1 : 0,
      (data.matchWholeWords ?? false) ? 1 : 0,
      (data.regex ?? false) ? 1 : 0,
      (data.constant ?? false) ? 1 : 0,
      (data.selective ?? false) ? 1 : 0,
      (data.excludeRecursion ?? false) ? 1 : 0,
      data.groupId ?? null,
      data.cooldownTurns ?? null,
      data.delayTurns ?? null,
      data.stickyTurns ?? null,
      now,
      now,
    );

    return this.get(id)!;
  }

  get(id: string): LorebookEntry | null {
    const row = this.db.prepare('SELECT * FROM lorebook_entries WHERE id = ?').get(id) as any;
    return row ? this.rowToEntry(row) : null;
  }

  listByLorebook(lorebookId: string): LorebookEntry[] {
    const rows = this.db.prepare(
      'SELECT * FROM lorebook_entries WHERE lorebook_id = ? ORDER BY insertion_order ASC'
    ).all(lorebookId) as any[];
    return rows.map((r) => this.rowToEntry(r));
  }

  update(id: string, data: UpdateLorebookEntryPayload): LorebookEntry | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE lorebook_entries SET
        keys = ?, secondary_keys = ?, content = ?, enabled = ?,
        position = ?, insertion_order = ?, case_sensitive = ?,
        match_whole_words = ?, regex = ?, constant = ?, selective = ?,
        exclude_recursion = ?, group_id = ?,
        cooldown_turns = ?, delay_turns = ?, sticky_turns = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(data.keys ?? existing.keys),
      JSON.stringify(data.secondaryKeys ?? existing.secondaryKeys),
      data.content ?? existing.content,
      (data.enabled ?? existing.enabled) ? 1 : 0,
      data.position ?? existing.position,
      data.insertionOrder ?? existing.insertionOrder,
      (data.caseSensitive ?? existing.caseSensitive) ? 1 : 0,
      (data.matchWholeWords ?? existing.matchWholeWords) ? 1 : 0,
      (data.regex ?? existing.regex) ? 1 : 0,
      (data.constant ?? existing.constant) ? 1 : 0,
      (data.selective ?? existing.selective) ? 1 : 0,
      (data.excludeRecursion ?? existing.excludeRecursion) ? 1 : 0,
      data.groupId !== undefined ? data.groupId : existing.groupId,
      data.cooldownTurns !== undefined ? data.cooldownTurns : existing.cooldownTurns,
      data.delayTurns !== undefined ? data.delayTurns : existing.delayTurns,
      data.stickyTurns !== undefined ? data.stickyTurns : existing.stickyTurns,
      now,
      id,
    );

    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM lorebook_entries WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteByLorebook(lorebookId: string): number {
    const result = this.db.prepare('DELETE FROM lorebook_entries WHERE lorebook_id = ?').run(lorebookId);
    return result.changes;
  }

  private rowToEntry(row: any): LorebookEntry {
    return {
      id: row.id,
      lorebookId: row.lorebook_id,
      keys: JSON.parse(row.keys || '[]'),
      secondaryKeys: JSON.parse(row.secondary_keys || '[]'),
      content: row.content,
      enabled: !!row.enabled,
      position: row.position,
      insertionOrder: row.insertion_order,
      caseSensitive: !!row.case_sensitive,
      matchWholeWords: !!row.match_whole_words,
      regex: !!row.regex,
      constant: !!row.constant,
      selective: !!row.selective,
      excludeRecursion: !!row.exclude_recursion,
      groupId: row.group_id,
      cooldownTurns: row.cooldown_turns,
      delayTurns: row.delay_turns,
      stickyTurns: row.sticky_turns,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
