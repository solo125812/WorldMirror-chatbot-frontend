/**
 * Sampler Preset Repository — SQLite-backed CRUD
 */

import type Database from 'better-sqlite3';
import type { SamplerPreset, CreateSamplerPresetPayload, UpdateSamplerPresetPayload } from '@chatbot/types';
import { makeId, nowIso } from '@chatbot/utils';

export class SamplerPresetRepo {
    constructor(private db: Database.Database) { }

    create(data: CreateSamplerPresetPayload): SamplerPreset {
        const id = makeId();
        const now = nowIso();

        this.db.prepare(`
      INSERT INTO sampler_presets (id, name, description, source, settings, created_at, updated_at)
      VALUES (@id, @name, @description, @source, @settings, @created_at, @updated_at)
    `).run({
            id,
            name: data.name,
            description: data.description ?? '',
            source: 'user',
            settings: JSON.stringify(data.settings),
            created_at: now,
            updated_at: now,
        });

        return this.get(id)!;
    }

    get(id: string): SamplerPreset | null {
        const row = this.db.prepare('SELECT * FROM sampler_presets WHERE id = ?').get(id) as any;
        return row ? this.rowToPreset(row) : null;
    }

    update(id: string, data: UpdateSamplerPresetPayload): SamplerPreset | null {
        const existing = this.get(id);
        if (!existing) return null;

        // Don't allow modifying system presets
        if (existing.source === 'system') {
            throw new Error('Cannot modify system presets');
        }

        const updates: Record<string, unknown> = { updated_at: nowIso() };

        if (data.name !== undefined) updates.name = data.name;
        if (data.description !== undefined) updates.description = data.description;
        if (data.settings !== undefined) updates.settings = JSON.stringify(data.settings);

        const setClauses = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
        this.db.prepare(`UPDATE sampler_presets SET ${setClauses} WHERE id = @id`).run({ ...updates, id });

        return this.get(id);
    }

    delete(id: string): boolean {
        const existing = this.get(id);
        if (!existing) return false;
        if (existing.source === 'system') {
            throw new Error('Cannot delete system presets');
        }

        const result = this.db.prepare('DELETE FROM sampler_presets WHERE id = ?').run(id);
        return result.changes > 0;
    }

    list(): SamplerPreset[] {
        const rows = this.db.prepare('SELECT * FROM sampler_presets ORDER BY source DESC, name ASC').all() as any[];
        return rows.map((r) => this.rowToPreset(r));
    }

    private rowToPreset(row: any): SamplerPreset {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            source: row.source as 'system' | 'user',
            settings: JSON.parse(row.settings || '{}'),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
