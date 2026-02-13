/**
 * Unit tests for Memory Chunkers
 */

import { describe, it, expect } from 'vitest';
import {
  chunkByTokenWindow,
  chunkByMarkdown,
  chunk,
  estimateTokenCount,
} from '@chatbot/memory';

describe('estimateTokenCount', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('should estimate tokens for short text', () => {
    const tokens = estimateTokenCount('Hello world');
    expect(tokens).toBe(3); // ceil(2 * 1.3) = 3
  });

  it('should estimate tokens for longer text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const tokens = estimateTokenCount(text);
    expect(tokens).toBeGreaterThan(9);
    expect(tokens).toBeLessThan(20);
  });
});

describe('chunkByTokenWindow', () => {
  it('should return empty array for empty text', () => {
    expect(chunkByTokenWindow('')).toEqual([]);
  });

  it('should return single chunk for short text', () => {
    const chunks = chunkByTokenWindow('Hello world, this is a test.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toBe('Hello world, this is a test.');
  });

  it('should split long text into multiple chunks', () => {
    // Generate a long text with many words
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkByTokenWindow(text, { maxTokens: 100, overlap: 20 });

    expect(chunks.length).toBeGreaterThan(1);

    // Each chunk should have content
    for (const c of chunks) {
      expect(c.content.length).toBeGreaterThan(0);
      expect(c.tokenCount).toBeGreaterThan(0);
    }

    // Chunks should be indexed sequentially
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });

  it('should create overlapping chunks', () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkByTokenWindow(text, { maxTokens: 100, overlap: 30 });

    // With overlap, adjacent chunks should share some content
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const firstWords = chunks[0].content.split(' ');
    const secondWords = chunks[1].content.split(' ');
    // The tail of chunk 0 should overlap with the head of chunk 1
    const lastOfFirst = new Set(firstWords.slice(-30));
    const firstOfSecond = secondWords.slice(0, 30);
    const overlap = firstOfSecond.filter((w) => lastOfFirst.has(w));
    expect(overlap.length).toBeGreaterThan(0);
  });

  it('should respect custom maxTokens', () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkByTokenWindow(text, { maxTokens: 50, overlap: 10 });

    // Each chunk should not exceed the token budget
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(60); // Some slack for estimation
    }
  });

  it('should include metadata with strategy', () => {
    const chunks = chunkByTokenWindow('A short sentence for testing.', { maxTokens: 100 });
    expect(chunks[0].metadata).toBeDefined();
    expect(chunks[0].metadata!.strategy).toBe('token_window');
  });
});

describe('chunkByMarkdown', () => {
  it('should return empty array for empty text', () => {
    expect(chunkByMarkdown('')).toEqual([]);
  });

  it('should split on headings', () => {
    const md = `# Section 1

Content of section 1.

# Section 2

Content of section 2.

# Section 3

Content of section 3.`;

    const chunks = chunkByMarkdown(md, { maxTokens: 800 });
    // Should merge small sections into fewer chunks
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].content).toContain('Section 1');
  });

  it('should not split inside code blocks', () => {
    const md = `# Example

Some text.

\`\`\`javascript
# This is not a heading
const x = 1;
\`\`\`

More text.`;

    const chunks = chunkByMarkdown(md, { maxTokens: 800 });
    // Should treat the code block as a single unit
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // The code block comment should not cause a split
    const allContent = chunks.map((c) => c.content).join('\n');
    expect(allContent).toContain('# This is not a heading');
    expect(allContent).toContain('const x = 1');
  });

  it('should split large sections using token-window fallback', () => {
    const longContent = Array.from({ length: 500 }, (_, i) => `Sentence number ${i}.`).join(' ');
    const md = `# Big Section\n\n${longContent}`;
    const chunks = chunkByMarkdown(md, { maxTokens: 100 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.metadata?.strategy).toBe('markdown');
    }
  });

  it('should include heading in metadata', () => {
    const md = `# My Heading\n\nSome content here.`;
    const chunks = chunkByMarkdown(md, { maxTokens: 800 });
    expect(chunks[0].metadata?.heading).toContain('My Heading');
  });
});

describe('chunk (auto-detect)', () => {
  it('should use markdown strategy for text with headings', () => {
    const md = `# Title\n\nContent here.`;
    const chunks = chunk(md);
    expect(chunks[0].metadata?.strategy).toBe('markdown');
  });

  it('should use token_window strategy for plain text', () => {
    const text = 'Just some plain text without any headings at all.';
    const chunks = chunk(text);
    expect(chunks[0].metadata?.strategy).toBe('token_window');
  });

  it('should respect explicit strategy override', () => {
    const text = '# Has headings but use token window';
    const chunks = chunk(text, { strategy: 'token_window' });
    expect(chunks[0].metadata?.strategy).toBe('token_window');
  });
});
