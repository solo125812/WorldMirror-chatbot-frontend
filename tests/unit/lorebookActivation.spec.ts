/**
 * Unit tests for Lorebook Activation Engine
 */

import { describe, it, expect } from 'vitest';
import { activateLorebooks, formatLorebookSection } from '@chatbot/core';
import type { LoadedLorebook } from '@chatbot/core';
import type { LorebookEntry, Lorebook, LorebookActivationContext } from '@chatbot/types';

function makeLorebook(overrides: Partial<Lorebook> = {}): Lorebook {
  return {
    id: 'lb-1',
    name: 'Test Lorebook',
    description: '',
    scanDepth: 10,
    recursiveScan: false,
    caseSensitive: false,
    matchWholeWords: false,
    useGroupScoring: false,
    budgetTokens: 2048,
    minActivations: 0,
    maxRecursionSteps: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEntry(overrides: Partial<LorebookEntry> = {}): LorebookEntry {
  return {
    id: 'entry-1',
    lorebookId: 'lb-1',
    keys: ['dragon'],
    secondaryKeys: [],
    content: 'Dragons are powerful creatures.',
    enabled: true,
    position: 'after_system',
    insertionOrder: 0,
    caseSensitive: false,
    matchWholeWords: false,
    regex: false,
    selective: false,
    constant: false,
    excludeRecursion: false,
    groupId: null,
    cooldownTurns: null,
    delayTurns: null,
    stickyTurns: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<LorebookActivationContext> = {}): LorebookActivationContext {
  return {
    messages: [
      { id: 'msg-1', role: 'user', content: 'Tell me about the dragon', createdAt: '2024-01-01T00:00:00Z' },
    ],
    ...overrides,
  };
}

describe('activateLorebooks', () => {
  it('should activate entries whose keywords match message text', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({ keys: ['dragon'] });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);

    expect(result.activatedCount).toBe(1);
    expect(result.sections.after_system).toContain('Dragons are powerful creatures.');
  });

  it('should not activate when no keywords match', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({ keys: ['unicorn'] });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);

    expect(result.activatedCount).toBe(0);
  });

  it('should always activate constant entries', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({ keys: ['nonexistent'], constant: true });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);

    expect(result.activatedCount).toBe(1);
  });

  it('should support case-sensitive matching', () => {
    const lorebook = makeLorebook({ caseSensitive: true });
    const entry = makeEntry({ keys: ['Dragon'] });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];

    // Message has lowercase 'dragon'
    const context = makeContext();
    const result = activateLorebooks(loaded, context);

    // Should not match since case sensitive
    expect(result.activatedCount).toBe(0);
  });

  it('should support whole-word matching', () => {
    const lorebook = makeLorebook({ matchWholeWords: true });
    const entry = makeEntry({ keys: ['drag'] });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const context = makeContext();

    // 'drag' should not match 'dragon' with whole-word
    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(0);
  });

  it('should support regex matching', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({ keys: ['drag(on|ons)'], regex: true });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(1);
  });

  it('should enforce inclusion groups (only first match per group)', () => {
    const lorebook = makeLorebook();
    const entry1 = makeEntry({ id: 'e1', keys: ['dragon'], groupId: 'grp-1', insertionOrder: 0 });
    const entry2 = makeEntry({ id: 'e2', keys: ['dragon'], groupId: 'grp-1', insertionOrder: 1, content: 'Second dragon entry' });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry1, entry2] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(1);
    expect(result.sections.after_system).toContain('Dragons are powerful creatures.');
  });

  it('should support selective mode (require secondary keys)', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({
      keys: ['dragon'],
      secondaryKeys: ['fire'],
      selective: true,
    });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];

    // Message mentions dragon but not fire
    const context = makeContext();
    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(0);

    // Message mentions both
    const context2 = makeContext({
      messages: [
        { id: 'msg-1', role: 'user', content: 'The fire-breathing dragon', createdAt: '2024-01-01T00:00:00Z' },
      ],
    });
    const result2 = activateLorebooks(loaded, context2);
    expect(result2.activatedCount).toBe(1);
  });

  it('should enforce budget limit', () => {
    const lorebook = makeLorebook({ budgetTokens: 5 }); // Very small budget
    const entry = makeEntry({
      content: 'This is a very long content that exceeds the budget token limit by quite a lot and should be blocked.',
    });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);
    expect(result.budgetExceeded).toBe(true);
    expect(result.activatedCount).toBe(0);
  });

  it('should place entries in the correct position', () => {
    const lorebook = makeLorebook();
    const e1 = makeEntry({ id: 'e1', keys: ['dragon'], position: 'before_history', content: 'Before history entry' });
    const e2 = makeEntry({ id: 'e2', keys: ['dragon'], position: 'after_persona', content: 'After persona entry' });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [e1, e2] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);
    expect(result.sections.before_history).toContain('Before history entry');
    expect(result.sections.after_persona).toContain('After persona entry');
  });

  it('should skip disabled entries', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({ keys: ['dragon'], enabled: false });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(0);
  });

  it('should block activation when delayTurns is set and no history exists', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({ delayTurns: 2 });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const context = makeContext({
      currentTurn: 1,
      activationHistory: new Map(),
    });

    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(0);
  });

  it('should block activation during cooldown window', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({ cooldownTurns: 3 });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const history = new Map<string, { lastActivatedTurn: number }>([
      ['entry-1', { lastActivatedTurn: 4 }],
    ]);
    const context = makeContext({
      currentTurn: 5,
      activationHistory: history,
    });

    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(0);
  });

  it('should allow activation after cooldown window', () => {
    const lorebook = makeLorebook();
    const entry = makeEntry({ cooldownTurns: 3 });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry] }];
    const history = new Map<string, { lastActivatedTurn: number }>([
      ['entry-1', { lastActivatedTurn: 1 }],
    ]);
    const context = makeContext({
      currentTurn: 6,
      activationHistory: history,
    });

    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(1);
  });

  it('should activate recursively when entry content triggers another', () => {
    const lorebook = makeLorebook({ recursiveScan: true, maxRecursionSteps: 2 });
    const entry1 = makeEntry({
      id: 'e1',
      keys: ['dragon'],
      content: 'Elves live in the mountains.',
      insertionOrder: 0,
    });
    const entry2 = makeEntry({
      id: 'e2',
      keys: ['elves'],
      content: 'Elves are agile.',
      insertionOrder: 1,
    });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry1, entry2] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);
    expect(result.activatedCount).toBe(2);
    expect(result.sections.after_system).toContain('Elves are agile.');
  });

  it('should honor excludeRecursion to prevent chained activation', () => {
    const lorebook = makeLorebook({ recursiveScan: true, maxRecursionSteps: 2 });
    const entry1 = makeEntry({
      id: 'e1',
      keys: ['dragon'],
      content: 'Elves live in the mountains.',
      excludeRecursion: true,
      insertionOrder: 0,
    });
    const entry2 = makeEntry({
      id: 'e2',
      keys: ['elves'],
      content: 'Elves are agile.',
      insertionOrder: 1,
    });
    const loaded: LoadedLorebook[] = [{ lorebook, entries: [entry1, entry2] }];
    const context = makeContext();

    const result = activateLorebooks(loaded, context);
    expect(result.sections.after_system).toContain('Elves live in the mountains.');
    expect(result.sections.after_system).not.toContain('Elves are agile.');
  });
});

describe('formatLorebookSection', () => {
  it('should join sections with double newlines', () => {
    const sections = ['First entry.', 'Second entry.'];
    const result = formatLorebookSection(sections);
    expect(result).toBe('First entry.\n\nSecond entry.');
  });

  it('should return empty string for empty sections', () => {
    const result = formatLorebookSection([]);
    expect(result).toBe('');
  });
});
