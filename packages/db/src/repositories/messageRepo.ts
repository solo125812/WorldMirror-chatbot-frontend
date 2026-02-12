/**
 * Message Repository — SQLite-backed with swipe support
 */

import type Database from 'better-sqlite3';
import type { ChatMessage } from '@chatbot/types';
import { makeId, nowIso } from '@chatbot/utils';

export interface Swipe {
  id: string;
  content: string;
  createdAt: string;
  generationInfo?: {
    model?: string;
    providerId?: string;
    tokensUsed?: number;
    latencyMs?: number;
    samplerSettings?: Record<string, unknown>;
  };
}

export class MessageRepo {
  constructor(private db: Database.Database) { }

  addMessage(chatId: string, data: {
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): ChatMessage {
    const id = makeId();
    const now = nowIso();

    // For assistant messages, initialize swipes with the first response
    const metadata = { ...data.metadata };
    if (data.role === 'assistant') {
      metadata.swipes = metadata.swipes ?? [{
        id: makeId(),
        content: data.content,
        createdAt: now,
      }];
    }

    this.db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, metadata, active_swipe_index, created_at)
      VALUES (@id, @chat_id, @role, @content, @metadata, @active_swipe_index, @created_at)
    `).run({
      id,
      chat_id: chatId,
      role: data.role,
      content: data.content,
      metadata: JSON.stringify(metadata),
      active_swipe_index: 0,
      created_at: now,
    });

    // Update the chat's updated_at
    this.db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(now, chatId);

    return this.getMessage(id)!;
  }

  getMessage(id: string): ChatMessage | null {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
    return row ? this.rowToMessage(row) : null;
  }

  updateMessage(id: string, data: { content?: string; metadata?: Record<string, unknown> }): ChatMessage | null {
    const existing = this.getMessage(id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};
    if (data.content !== undefined) updates.content = data.content;
    if (data.metadata !== undefined) updates.metadata = JSON.stringify(data.metadata);

    if (Object.keys(updates).length === 0) return existing;

    const setClauses = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
    this.db.prepare(`UPDATE messages SET ${setClauses} WHERE id = @id`).run({ ...updates, id });

    return this.getMessage(id);
  }

  deleteMessage(id: string): boolean {
    const result = this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * List messages for a chat with cursor-based pagination.
   * @param chatId - Chat ID
   * @param opts.limit - Max number of messages to return
   * @param opts.before - Return messages created before this ISO timestamp (cursor)
   */
  listMessages(chatId: string, opts: { limit?: number; before?: string } = {}): {
    messages: ChatMessage[];
    hasMore: boolean;
  } {
    const limit = opts.limit ?? 50;
    const params: Record<string, unknown> = { chat_id: chatId, limit: limit + 1 };

    let query = 'SELECT * FROM messages WHERE chat_id = @chat_id';
    if (opts.before) {
      query += ' AND created_at < @before';
      params.before = opts.before;
    }
    query += ' ORDER BY created_at DESC LIMIT @limit';

    const rows = this.db.prepare(query).all(params) as any[];
    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse().map((r: any) => this.rowToMessage(r));

    return { messages, hasMore };
  }

  clearMessages(chatId: string): void {
    this.db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
  }

  /**
   * Add a swipe to an assistant message.
   */
  addSwipe(messageId: string, swipe: Omit<Swipe, 'id'>): Swipe {
    const row = this.db.prepare('SELECT metadata, role FROM messages WHERE id = ?').get(messageId) as any;
    if (!row) throw new Error('Message not found');
    if (row.role !== 'assistant') throw new Error('Swipes only supported on assistant messages');

    const metadata = JSON.parse(row.metadata || '{}');
    const swipes: Swipe[] = metadata.swipes ?? [];
    const newSwipe: Swipe = {
      id: makeId(),
      ...swipe,
    };
    swipes.push(newSwipe);
    metadata.swipes = swipes;

    // Update content to the new swipe and set it as active
    const newIndex = swipes.length - 1;
    this.db.prepare(
      'UPDATE messages SET content = @content, metadata = @metadata, active_swipe_index = @index WHERE id = @id'
    ).run({
      content: newSwipe.content,
      metadata: JSON.stringify(metadata),
      index: newIndex,
      id: messageId,
    });

    return newSwipe;
  }

  /**
   * Set the active swipe for a message.
   */
  setActiveSwipe(messageId: string, swipeIndex: number): ChatMessage | null {
    const row = this.db.prepare('SELECT metadata FROM messages WHERE id = ?').get(messageId) as any;
    if (!row) return null;

    const metadata = JSON.parse(row.metadata || '{}');
    const swipes: Swipe[] = metadata.swipes ?? [];

    if (swipeIndex < 0 || swipeIndex >= swipes.length) {
      throw new Error(`Swipe index ${swipeIndex} out of range (0-${swipes.length - 1})`);
    }

    const activeSwipe = swipes[swipeIndex];
    this.db.prepare(
      'UPDATE messages SET content = @content, active_swipe_index = @index WHERE id = @id'
    ).run({
      content: activeSwipe.content,
      index: swipeIndex,
      id: messageId,
    });

    return this.getMessage(messageId);
  }

  private rowToMessage(row: any): ChatMessage {
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
      metadata: JSON.parse(row.metadata || '{}'),
      activeSwipeIndex: row.active_swipe_index,
    };
  }
}
