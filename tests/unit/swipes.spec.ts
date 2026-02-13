/**
 * Unit tests — Swipe support in MessageRepo
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, resetDatabase, ChatRepo, MessageRepo } from '@chatbot/db';
import { resolve } from 'node:path';

describe('MessageRepo swipes', () => {
  let chatRepo: ChatRepo;
  let messageRepo: MessageRepo;
  let dbClient: ReturnType<typeof createTestDatabase>;

  beforeAll(() => {
    const migrationsDir = resolve(process.cwd(), 'apps/server/migrations');
    dbClient = createTestDatabase(migrationsDir);
    chatRepo = new ChatRepo(dbClient.db);
    messageRepo = new MessageRepo(dbClient.db);
  });

  afterAll(() => {
    dbClient.close();
    resetDatabase();
  });

  it('should initialize swipes for assistant messages', () => {
    const chat = chatRepo.createChat();
    const msg = messageRepo.addMessage(chat.id, {
      role: 'assistant',
      content: 'First reply',
    });

    expect(msg.metadata?.swipes?.length).toBe(1);
    expect(msg.metadata?.swipes?.[0].content).toBe('First reply');
    expect(msg.activeSwipeIndex).toBe(0);
  });

  it('should add and activate a new swipe', () => {
    const chat = chatRepo.createChat();
    const msg = messageRepo.addMessage(chat.id, {
      role: 'assistant',
      content: 'Original',
    });

    const newSwipe = messageRepo.addSwipe(msg.id, {
      content: 'Alternative',
      createdAt: new Date().toISOString(),
    });

    expect(newSwipe.content).toBe('Alternative');

    const updated = messageRepo.getMessage(msg.id)!;
    expect(updated.content).toBe('Alternative');
    expect(updated.activeSwipeIndex).toBe(1);
    expect(updated.metadata?.swipes?.length).toBe(2);
  });

  it('should set an existing swipe as active', () => {
    const chat = chatRepo.createChat();
    const msg = messageRepo.addMessage(chat.id, {
      role: 'assistant',
      content: 'Original',
    });

    messageRepo.addSwipe(msg.id, {
      content: 'Alt 1',
      createdAt: new Date().toISOString(),
    });

    const updated = messageRepo.setActiveSwipe(msg.id, 0)!;
    expect(updated.content).toBe('Original');
    expect(updated.activeSwipeIndex).toBe(0);
  });
});
