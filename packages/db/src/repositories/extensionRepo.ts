/**
 * ExtensionRepo — CRUD for installed extensions
 */

import type Database from 'better-sqlite3';
import type { InstalledExtension, InstallExtensionPayload, UpdateExtensionPayload, ExtensionSource, ExtensionScope } from '@chatbot/types';
import { randomUUID } from 'node:crypto';

export class ExtensionRepo {
  constructor(private db: Database.Database) {}

  create(data: {
    name: string;
    displayName: string;
    version?: string;
    description?: string;
    author?: string;
    source: ExtensionSource;
    scope?: ExtensionScope;
    repoUrl?: string | null;
    branch?: string | null;
    commit?: string | null;
  }): InstalledExtension {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO extensions (id, name, display_name, version, description, author, source, scope, repo_url, branch, commit_hash, enabled, installed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      data.name,
      data.displayName,
      data.version ?? '0.0.0',
      data.description ?? '',
      data.author ?? '',
      data.source,
      data.scope ?? 'global',
      data.repoUrl ?? null,
      data.branch ?? null,
      data.commit ?? null,
      now,
      now,
    );
    return this.get(id)!;
  }

  get(id: string): InstalledExtension | null {
    const row = this.db.prepare('SELECT * FROM extensions WHERE id = ?').get(id) as any;
    return row ? this.rowToExtension(row) : null;
  }

  getByName(name: string): InstalledExtension | null {
    const row = this.db.prepare('SELECT * FROM extensions WHERE name = ?').get(name) as any;
    return row ? this.rowToExtension(row) : null;
  }

  update(id: string, data: {
    enabled?: boolean;
    version?: string;
    commit?: string;
    branch?: string;
  }): InstalledExtension | null {
    const existing = this.get(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }
    if (data.version !== undefined) {
      fields.push('version = ?');
      values.push(data.version);
    }
    if (data.commit !== undefined) {
      fields.push('commit_hash = ?');
      values.push(data.commit);
    }
    if (data.branch !== undefined) {
      fields.push('branch = ?');
      values.push(data.branch);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`UPDATE extensions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM extensions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteByName(name: string): boolean {
    const result = this.db.prepare('DELETE FROM extensions WHERE name = ?').run(name);
    return result.changes > 0;
  }

  list(opts: { scope?: ExtensionScope; limit?: number; offset?: number } = {}): {
    items: InstalledExtension[];
    total: number;
  } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.scope) {
      conditions.push('scope = ?');
      params.push(opts.scope);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM extensions ${where}`).get(...params) as any).count;

    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    const rows = this.db.prepare(`SELECT * FROM extensions ${where} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];

    return {
      items: rows.map((r) => this.rowToExtension(r)),
      total,
    };
  }

  private rowToExtension(row: any): InstalledExtension {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      version: row.version,
      description: row.description,
      author: row.author,
      source: row.source as ExtensionSource,
      scope: row.scope as ExtensionScope,
      repoUrl: row.repo_url,
      branch: row.branch,
      commit: row.commit_hash,
      enabled: !!row.enabled,
      installedAt: row.installed_at,
      updatedAt: row.updated_at,
    };
  }
}
