/**
 * Unit tests for code indexer scanner and chunker
 */

import { describe, it, expect } from 'vitest';
import { detectLanguage, hashFile } from '@chatbot/indexer';
import { chunkCode } from '@chatbot/indexer';

describe('detectLanguage', () => {
  it('should detect TypeScript files', () => {
    expect(detectLanguage('src/app.ts')).toBe('typescript');
    expect(detectLanguage('component.tsx')).toBe('typescript');
  });

  it('should detect JavaScript files', () => {
    expect(detectLanguage('index.js')).toBe('javascript');
    expect(detectLanguage('module.mjs')).toBe('javascript');
  });

  it('should detect Python files', () => {
    expect(detectLanguage('main.py')).toBe('python');
  });

  it('should detect Svelte files', () => {
    expect(detectLanguage('App.svelte')).toBe('svelte');
  });

  it('should return unknown for unrecognized extensions', () => {
    expect(detectLanguage('file.xyz')).toBe('unknown');
    expect(detectLanguage('binary.exe')).toBe('unknown');
  });

  it('should handle markdown files', () => {
    expect(detectLanguage('README.md')).toBe('markdown');
  });
});

describe('hashFile', () => {
  it('should produce consistent hashes', () => {
    const hash1 = hashFile('hello world');
    const hash2 = hashFile('hello world');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = hashFile('hello');
    const hash2 = hashFile('world');
    expect(hash1).not.toBe(hash2);
  });

  it('should return a 16-char hex string', () => {
    const hash = hashFile('test content');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('chunkCode', () => {
  it('should return empty array for very small files', () => {
    const content = 'const x = 1;\n';
    const chunks = chunkCode(content, 'test.ts', 'typescript', 'doc-1', 'workspace', hashFile(content), { minLines: 5 });
    expect(chunks).toEqual([]);
  });

  it('should return a single chunk for small files', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `const line${i} = ${i};`);
    const content = lines.join('\n');
    const chunks = chunkCode(content, 'test.ts', 'typescript', 'doc-1', 'workspace', hashFile(content), { maxLines: 200, minLines: 5 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.filePath).toBe('test.ts');
    expect(chunks[0]!.language).toBe('typescript');
    expect(chunks[0]!.lineStart).toBe(1);
    expect(chunks[0]!.lineEnd).toBe(20);
  });

  it('should split large files into multiple chunks', () => {
    const lines = Array.from({ length: 500 }, (_, i) => `const line${i} = ${i};`);
    const content = lines.join('\n');
    const chunks = chunkCode(content, 'big.ts', 'typescript', 'doc-1', 'workspace', hashFile(content), { maxLines: 100, minLines: 5, overlapLines: 10 });
    expect(chunks.length).toBeGreaterThan(1);

    // All chunks should have correct filePath
    for (const chunk of chunks) {
      expect(chunk.filePath).toBe('big.ts');
      expect(chunk.language).toBe('typescript');
      expect(chunk.documentId).toBe('doc-1');
    }
  });

  it('should include hash for each chunk', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    const content = lines.join('\n');
    const chunks = chunkCode(content, 'test.ts', 'typescript', 'doc-1', 'workspace', hashFile(content));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.hash).toMatch(/^[0-9a-f]{16}$/);
  });
});
