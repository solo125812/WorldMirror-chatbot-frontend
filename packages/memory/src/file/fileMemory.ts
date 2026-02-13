/**
 * File-Backed Memory — Tier 1 memory: human-readable markdown files
 * 
 * Stores memory entries as daily markdown logs in data/memory/YYYY-MM-DD.md
 * Maintains an index.json for quick lookup.
 * 
 * Git-trackable and user-editable.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { logger, nowIso } from '@chatbot/utils';
import type { MemoryEntry, MemoryScope, MemoryCategory } from '@chatbot/types';

export interface FileMemoryConfig {
  /** Base directory for memory files. Default: data/memory */
  baseDir: string;
}

export interface FileMemoryIndex {
  entries: FileMemoryIndexEntry[];
  lastUpdated: string;
}

export interface FileMemoryIndexEntry {
  id: string;
  date: string;
  category: MemoryCategory;
  scope: MemoryScope;
  sourceId?: string;
  preview: string;
  createdAt: string;
}

export class FileMemory {
  private baseDir: string;
  private indexPath: string;
  private index: FileMemoryIndex;

  constructor(config: FileMemoryConfig) {
    this.baseDir = resolve(config.baseDir);
    this.indexPath = join(this.baseDir, 'index.json');

    // Ensure directory exists
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }

    // Load or create index
    this.index = this.loadIndex();
  }

  /**
   * Append a memory entry to the daily log file.
   */
  write(entry: MemoryEntry): void {
    const date = this.extractDate(entry.createdAt);
    const filePath = join(this.baseDir, `${date}.md`);

    // Build markdown entry
    const tags = [
      `category:${entry.category}`,
      `scope:${entry.scope}`,
      ...(entry.sourceId ? [`source:${entry.sourceId}`] : []),
      ...(entry.autoCaptured ? ['auto'] : []),
      `importance:${entry.importance.toFixed(2)}`,
    ];

    const mdEntry = [
      `### [${entry.createdAt}] ${entry.category}`,
      `> ID: ${entry.id} | Tags: ${tags.join(', ')}`,
      '',
      entry.content,
      '',
      '---',
      '',
    ].join('\n');

    // Append to daily file
    let existing = '';
    if (existsSync(filePath)) {
      existing = readFileSync(filePath, 'utf-8');
    } else {
      existing = `# Memory Log — ${date}\n\n`;
    }

    writeFileSync(filePath, existing + mdEntry, 'utf-8');

    // Update index
    this.index.entries.push({
      id: entry.id,
      date,
      category: entry.category,
      scope: entry.scope,
      sourceId: entry.sourceId,
      preview: entry.content.slice(0, 100),
      createdAt: entry.createdAt,
    });
    this.index.lastUpdated = nowIso();
    this.saveIndex();

    logger.info(`Memory written to file: ${filePath}`, { id: entry.id });
  }

  /**
   * Read all entries from a specific date.
   */
  readDate(date: string): string | null {
    const filePath = join(this.baseDir, `${date}.md`);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf-8');
  }

  /**
   * List all available dates.
   */
  listDates(): string[] {
    if (!existsSync(this.baseDir)) return [];
    return readdirSync(this.baseDir)
      .filter((f) => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map((f) => f.replace('.md', ''))
      .sort()
      .reverse();
  }

  /**
   * Search through file-backed memory by keyword.
   */
  search(query: string, opts: {
    scope?: MemoryScope;
    sourceId?: string;
    limit?: number;
  } = {}): FileMemoryIndexEntry[] {
    const limit = opts.limit ?? 20;
    const queryLower = query.toLowerCase();

    let results = this.index.entries.filter((e) => {
      if (opts.scope && e.scope !== opts.scope) return false;
      if (opts.sourceId && e.sourceId !== opts.sourceId) return false;
      if (e.preview.toLowerCase().includes(queryLower)) return true;
      const full = this.getEntryContent(e.id);
      return full ? full.toLowerCase().includes(queryLower) : false;
    });

    // Sort by recency
    results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return results.slice(0, limit);
  }

  /**
   * Get the full content of a specific memory entry from its daily file.
   */
  getEntryContent(id: string): string | null {
    const indexEntry = this.index.entries.find((e) => e.id === id);
    if (!indexEntry) return null;

    const fileContent = this.readDate(indexEntry.date);
    if (!fileContent) return null;

    // Parse the entry from the file using its ID
    const pattern = new RegExp(
      `### \\[.*?\\].*?\\n> ID: ${id}.*?\\n\\n([\\s\\S]*?)\\n---`,
      'm'
    );
    const match = fileContent.match(pattern);
    return match ? match[1].trim() : null;
  }

  /**
   * Delete an entry from the index. Note: does not rewrite the markdown log.
   */
  deleteEntry(id: string): boolean {
    const idx = this.index.entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;

    this.index.entries.splice(idx, 1);
    this.index.lastUpdated = nowIso();
    this.saveIndex();
    return true;
  }

  /**
   * Get the index.
   */
  getIndex(): FileMemoryIndex {
    return this.index;
  }

  /**
   * Get index entry count.
   */
  count(): number {
    return this.index.entries.length;
  }

  private extractDate(isoString: string): string {
    // Extract YYYY-MM-DD from ISO string
    return isoString.slice(0, 10);
  }

  private loadIndex(): FileMemoryIndex {
    if (existsSync(this.indexPath)) {
      try {
        const raw = readFileSync(this.indexPath, 'utf-8');
        return JSON.parse(raw);
      } catch (error) {
        logger.warn('Failed to load memory index, creating new one', error);
      }
    }
    return { entries: [], lastUpdated: nowIso() };
  }

  private saveIndex(): void {
    try {
      writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save memory index', error);
    }
  }
}
