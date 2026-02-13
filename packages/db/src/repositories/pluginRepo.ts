/**
 * PluginRepo — CRUD for installed plugins
 */

import type Database from 'better-sqlite3';
import type { InstalledPlugin, PluginPermission, UpdatePluginPayload, PluginConfigField } from '@chatbot/types';
import { randomUUID } from 'node:crypto';

export class PluginRepo {
  constructor(private db: Database.Database) {}

  create(data: {
    id: string;
    name: string;
    version: string;
    description: string;
    entry: string;
    permissions: PluginPermission[];
    configSchema?: Record<string, PluginConfigField> | null;
  }): InstalledPlugin {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO plugins (id, name, version, description, entry, enabled, permissions, config_schema, plugin_config, installed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?)
    `).run(
      data.id,
      data.name,
      data.version,
      data.description,
      data.entry,
      JSON.stringify(data.permissions),
      data.configSchema ? JSON.stringify(data.configSchema) : null,
      now,
      now,
    );
    return this.get(data.id)!;
  }

  get(id: string): InstalledPlugin | null {
    const row = this.db.prepare('SELECT * FROM plugins WHERE id = ?').get(id) as any;
    return row ? this.rowToPlugin(row) : null;
  }

  update(id: string, data: UpdatePluginPayload): InstalledPlugin | null {
    const existing = this.get(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }
    if (data.pluginConfig !== undefined) {
      fields.push('plugin_config = ?');
      values.push(JSON.stringify(data.pluginConfig));
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`UPDATE plugins SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM plugins WHERE id = ?').run(id);
    return result.changes > 0;
  }

  list(opts: { enabled?: boolean; limit?: number; offset?: number } = {}): {
    items: InstalledPlugin[];
    total: number;
  } {
    let where = '';
    const params: unknown[] = [];

    if (opts.enabled !== undefined) {
      where = 'WHERE enabled = ?';
      params.push(opts.enabled ? 1 : 0);
    }

    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM plugins ${where}`).get(...params) as any).count;

    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    const rows = this.db.prepare(`SELECT * FROM plugins ${where} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];

    return {
      items: rows.map((r) => this.rowToPlugin(r)),
      total,
    };
  }

  // Permission management
  grantPermission(pluginId: string, permission: PluginPermission): void {
    const id = randomUUID();
    this.db.prepare(`
      INSERT OR REPLACE INTO plugin_permissions (id, plugin_id, permission, granted, granted_at)
      VALUES (?, ?, ?, 1, ?)
    `).run(id, pluginId, permission, new Date().toISOString());
  }

  revokePermission(pluginId: string, permission: PluginPermission): void {
    this.db.prepare('DELETE FROM plugin_permissions WHERE plugin_id = ? AND permission = ?').run(pluginId, permission);
  }

  getPermissions(pluginId: string): Array<{ permission: PluginPermission; granted: boolean }> {
    const rows = this.db.prepare('SELECT permission, granted FROM plugin_permissions WHERE plugin_id = ?').all(pluginId) as any[];
    return rows.map((r) => ({
      permission: r.permission as PluginPermission,
      granted: !!r.granted,
    }));
  }

  private rowToPlugin(row: any): InstalledPlugin {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      entry: row.entry,
      enabled: !!row.enabled,
      permissions: JSON.parse(row.permissions || '[]'),
      configSchema: row.config_schema ? JSON.parse(row.config_schema) : null,
      pluginConfig: row.plugin_config ? JSON.parse(row.plugin_config) : null,
      installedAt: row.installed_at,
      updatedAt: row.updated_at,
    };
  }
}
