/**
 * Chat Checkpoint Repository
 * Phase 7 — Week 22
 */

import type Database from 'better-sqlite3';
import type { ChatCheckpoint } from '@chatbot/types';
import { makeId } from '@chatbot/utils';

export class CheckpointRepo {
  constructor(private db: Database.Database) {}

  create(chatId: string, messageId: string, label: string): ChatCheckpoint {
    const id = makeId();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO chat_checkpoints (id, chat_id, message_id, label, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, chatId, messageId, label, now);

    return { id, chatId, messageId, label, createdAt: now };
  }

  listByChatId(chatId: string): ChatCheckpoint[] {
    const rows = this.db
      .prepare('SELECT * FROM chat_checkpoints WHERE chat_id = ? ORDER BY created_at ASC')
      .all(chatId) as any[];

    return rows.map(this.rowToCheckpoint);
  }

  get(id: string): ChatCheckpoint | null {
    const row = this.db
      .prepare('SELECT * FROM chat_checkpoints WHERE id = ?')
      .get(id) as any;

    return row ? this.rowToCheckpoint(row) : null;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM chat_checkpoints WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  deleteByChatId(chatId: string): number {
    const result = this.db
      .prepare('DELETE FROM chat_checkpoints WHERE chat_id = ?')
      .run(chatId);
    return result.changes;
  }

  private rowToCheckpoint(row: any): ChatCheckpoint {
    return {
      id: row.id,
      chatId: row.chat_id,
      messageId: row.message_id,
      label: row.label,
      createdAt: row.created_at,
    };
  }
}
