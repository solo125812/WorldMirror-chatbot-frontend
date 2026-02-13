/**
 * Unit tests for Vector Store
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryVectorStore } from '@chatbot/memory';

describe('InMemoryVectorStore', () => {
  it('persists small datasets immediately', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wm-vectors-'));
    const persistPath = join(dir, 'vectors.json');

    try {
      const store = new InMemoryVectorStore({ dimensions: 3, persistPath });
      store.insert('a', [1, 0, 0], { type: 'memory' });

      const raw = readFileSync(persistPath, 'utf-8');
      const data = JSON.parse(raw);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].id).toBe('a');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters by metadata during search', () => {
    const store = new InMemoryVectorStore({ dimensions: 2 });
    store.insert('a', [1, 0], { scope: 'global' });
    store.insert('b', [1, 0], { scope: 'chat' });

    const results = store.search([1, 0], 10, { scope: 'chat' });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('b');
  });
});
