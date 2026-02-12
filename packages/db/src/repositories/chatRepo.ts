/**
 * Chat Repository — SQLite-backed
 */

import type Database from 'better-sqlite3';
import type { Chat } from '@chatbot/types';
import { makeId, nowIso } from '@chatbot/utils';

export class ChatRepo {
  constructor(private db: Database.Database) { }

  createChat(data: {
    title?: string;
    characterId?: string;
    activeModelId?: string;
    samplerPresetId?: string;
    metadata?: Record<string, unknown>;
  } = {}): Chat {
    const id = makeId();
    const now = nowIso();

    this.db.prepare(`
      INSERT INTO chats (id, title, character_id, active_model_id, sampler_preset_id, metadata, created_at, updated_at)
      VALUES (@id, @title, @character_id, @active_model_id, @sampler_preset_id, @metadata, @created_at, @updated_at)
    `).run({
      id,
      title: data.title ?? 'New Chat',
      character_id: data.characterId ?? null,
      active_model_id: data.activeModelId ?? null,
      sampler_preset_id: data.samplerPresetId ?? null,
      metadata: JSON.stringify(data.metadata ?? {}),
      created_at: now,
      updated_at: now,
    });

    return this.getChat(id)!;
  }

  getChat(id: string): Chat | null {
    const row = this.db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as any;
    return row ? this.rowToChat(row) : null;
  }

  updateChat(id: string, data: Partial<{
    title: string;
    characterId: string;
    activeModelId: string;
    samplerPresetId: string;
    metadata: Record<string, unknown>;
  }>): Chat | null {
    const existing = this.getChat(id);
    if (!existing) return null;

    const updates: Record<string, unknown> = { updated_at: nowIso() };

    if (data.title !== undefined) updates.title = data.title;
    if (data.characterId !== undefined) updates.character_id = data.characterId;
    if (data.activeModelId !== undefined) updates.active_model_id = data.activeModelId;
    if (data.samplerPresetId !== undefined) updates.sampler_preset_id = data.samplerPresetId;
    if (data.metadata !== undefined) updates.metadata = JSON.stringify(data.metadata);

    const setClauses = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
    this.db.prepare(`UPDATE chats SET ${setClauses} WHERE id = @id`).run({ ...updates, id });

    return this.getChat(id);
  }

  deleteChat(id: string): boolean {
    const result = this.db.prepare('DELETE FROM chats WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listChats(opts: { limit?: number; offset?: number; characterId?: string } = {}): {
    chats: Chat[];
    total: number;
  } {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (opts.characterId) {
      conditions.push('character_id = @characterId');
      params.characterId = opts.characterId;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM chats ${where}`).get(params) as any).count;
    const rows = this.db.prepare(
      `SELECT * FROM chats ${where} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit, offset }) as any[];

    return {
      chats: rows.map((r) => this.rowToChat(r)),
      total,
    };
  }

  private rowToChat(row: any): Chat {
    return {
      id: row.id,
      title: row.title,
      characterId: row.character_id ?? undefined,
      activeModelId: row.active_model_id ?? undefined,
      samplerPresetId: row.sampler_preset_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: [],
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
}
