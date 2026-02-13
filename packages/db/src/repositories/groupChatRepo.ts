/**
 * Group Chat Repository — CRUD operations for group chats
 */

import type Database from 'better-sqlite3';
import type { GroupChat, CreateGroupChatPayload, UpdateGroupChatPayload, ChatGroupBinding } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class GroupChatRepo {
  constructor(private db: Database.Database) {}

  create(data: CreateGroupChatPayload): GroupChat {
    const id = makeId();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO group_chats (id, name, character_ids, activation_strategy,
        allow_self_responses, reply_order, generation_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      JSON.stringify(data.characterIds),
      data.activationStrategy ?? 'sequential',
      (data.allowSelfResponses ?? false) ? 1 : 0,
      JSON.stringify(data.replyOrder ?? data.characterIds),
      data.generationMode ?? 'one_at_a_time',
      now,
      now,
    );

    return this.get(id)!;
  }

  get(id: string): GroupChat | null {
    const row = this.db.prepare('SELECT * FROM group_chats WHERE id = ?').get(id) as any;
    return row ? this.rowToGroupChat(row) : null;
  }

  update(id: string, data: UpdateGroupChatPayload): GroupChat | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE group_chats SET
        name = ?, character_ids = ?, activation_strategy = ?,
        allow_self_responses = ?, reply_order = ?, generation_mode = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      data.name ?? existing.name,
      JSON.stringify(data.characterIds ?? existing.characterIds),
      data.activationStrategy ?? existing.activationStrategy,
      (data.allowSelfResponses ?? existing.allowSelfResponses) ? 1 : 0,
      JSON.stringify(data.replyOrder ?? existing.replyOrder),
      data.generationMode ?? existing.generationMode,
      now,
      id,
    );

    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM group_chats WHERE id = ?').run(id);
    return result.changes > 0;
  }

  list(opts: { limit?: number; offset?: number } = {}): {
    groups: GroupChat[];
    total: number;
  } {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    const total = (this.db.prepare('SELECT COUNT(*) as count FROM group_chats').get() as any).count;

    const rows = this.db.prepare(
      'SELECT * FROM group_chats ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset) as any[];

    return {
      groups: rows.map((r) => this.rowToGroupChat(r)),
      total,
    };
  }

  // ─── Chat-Group Bindings ────────────────────────────────────────────

  bindChat(chatId: string, groupId: string): ChatGroupBinding {
    const id = makeId();
    this.db.prepare(
      'INSERT INTO chat_group_bindings (id, chat_id, group_id) VALUES (?, ?, ?)'
    ).run(id, chatId, groupId);
    return { id, chatId, groupId };
  }

  unbindChat(chatId: string): boolean {
    const result = this.db.prepare('DELETE FROM chat_group_bindings WHERE chat_id = ?').run(chatId);
    return result.changes > 0;
  }

  getGroupForChat(chatId: string): GroupChat | null {
    const binding = this.db.prepare(
      'SELECT * FROM chat_group_bindings WHERE chat_id = ?'
    ).get(chatId) as any;
    if (!binding) return null;
    return this.get(binding.group_id);
  }

  private rowToGroupChat(row: any): GroupChat {
    return {
      id: row.id,
      name: row.name,
      characterIds: JSON.parse(row.character_ids || '[]'),
      activationStrategy: row.activation_strategy,
      allowSelfResponses: !!row.allow_self_responses,
      replyOrder: JSON.parse(row.reply_order || '[]'),
      generationMode: row.generation_mode,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
