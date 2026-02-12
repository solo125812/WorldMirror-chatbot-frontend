/**
 * Character Repository — SQLite-backed CRUD
 */

import type Database from 'better-sqlite3';
import type { Character, CreateCharacterPayload, UpdateCharacterPayload } from '@chatbot/types';
import { makeId, nowIso } from '@chatbot/utils';

export class CharacterRepo {
    constructor(private db: Database.Database) { }

    createCharacter(data: CreateCharacterPayload): Character {
        const id = makeId();
        const now = nowIso();
        const row = {
            id,
            name: data.name,
            description: data.description ?? '',
            personality: data.personality ?? '',
            scenario: data.scenario ?? '',
            first_message: data.firstMessage ?? '',
            example_messages: data.exampleMessages ?? '',
            system_prompt: data.systemPrompt ?? '',
            post_history_instructions: data.postHistoryInstructions ?? '',
            creator_notes: data.creatorNotes ?? '',
            tags: JSON.stringify(data.tags ?? []),
            avatar: data.avatar ?? null,
            alternate_greetings: JSON.stringify(data.alternateGreetings ?? []),
            prompt_assembly_order: data.promptAssemblyOrder ? JSON.stringify(data.promptAssemblyOrder) : null,
            use_profile_prompt_order: data.useProfilePromptOrder !== false ? 1 : 0,
            created_at: now,
            updated_at: now,
        };

        this.db.prepare(`
      INSERT INTO characters (id, name, description, personality, scenario, first_message,
        example_messages, system_prompt, post_history_instructions, creator_notes,
        tags, avatar, alternate_greetings, prompt_assembly_order, use_profile_prompt_order,
        created_at, updated_at)
      VALUES (@id, @name, @description, @personality, @scenario, @first_message,
        @example_messages, @system_prompt, @post_history_instructions, @creator_notes,
        @tags, @avatar, @alternate_greetings, @prompt_assembly_order, @use_profile_prompt_order,
        @created_at, @updated_at)
    `).run(row);

        return this.getCharacter(id)!;
    }

    getCharacter(id: string): Character | null {
        const row = this.db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
        return row ? this.rowToCharacter(row) : null;
    }

    updateCharacter(id: string, data: UpdateCharacterPayload): Character | null {
        const existing = this.getCharacter(id);
        if (!existing) return null;

        const updates: Record<string, unknown> = { updated_at: nowIso() };

        if (data.name !== undefined) updates.name = data.name;
        if (data.description !== undefined) updates.description = data.description;
        if (data.personality !== undefined) updates.personality = data.personality;
        if (data.scenario !== undefined) updates.scenario = data.scenario;
        if (data.firstMessage !== undefined) updates.first_message = data.firstMessage;
        if (data.exampleMessages !== undefined) updates.example_messages = data.exampleMessages;
        if (data.systemPrompt !== undefined) updates.system_prompt = data.systemPrompt;
        if (data.postHistoryInstructions !== undefined) updates.post_history_instructions = data.postHistoryInstructions;
        if (data.creatorNotes !== undefined) updates.creator_notes = data.creatorNotes;
        if (data.tags !== undefined) updates.tags = JSON.stringify(data.tags);
        if (data.avatar !== undefined) updates.avatar = data.avatar;
        if (data.alternateGreetings !== undefined) updates.alternate_greetings = JSON.stringify(data.alternateGreetings);
        if (data.promptAssemblyOrder !== undefined) {
            updates.prompt_assembly_order = data.promptAssemblyOrder ? JSON.stringify(data.promptAssemblyOrder) : null;
        }
        if (data.useProfilePromptOrder !== undefined) {
            updates.use_profile_prompt_order = data.useProfilePromptOrder ? 1 : 0;
        }

        const setClauses = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
        this.db.prepare(`UPDATE characters SET ${setClauses} WHERE id = @id`).run({ ...updates, id });

        return this.getCharacter(id);
    }

    deleteCharacter(id: string): boolean {
        const result = this.db.prepare('DELETE FROM characters WHERE id = ?').run(id);
        return result.changes > 0;
    }

    listCharacters(opts: { search?: string; tags?: string[]; limit?: number; offset?: number } = {}): {
        characters: Character[];
        total: number;
    } {
        const limit = opts.limit ?? 50;
        const offset = opts.offset ?? 0;
        const conditions: string[] = [];
        const params: Record<string, unknown> = {};

        if (opts.search) {
            conditions.push('(name LIKE @search OR description LIKE @search)');
            params.search = `%${opts.search}%`;
        }

        if (opts.tags && opts.tags.length > 0) {
            // Match any of the specified tags
            const tagConditions = opts.tags.map((tag, i) => {
                const key = `tag_${i}`;
                params[key] = `%"${tag}"%`;
                return `tags LIKE @${key}`;
            });
            conditions.push(`(${tagConditions.join(' OR ')})`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const total = (this.db.prepare(`SELECT COUNT(*) as count FROM characters ${where}`).get(params) as any).count;
        const rows = this.db.prepare(
            `SELECT * FROM characters ${where} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`
        ).all({ ...params, limit, offset }) as any[];

        return {
            characters: rows.map((r) => this.rowToCharacter(r)),
            total,
        };
    }

    private rowToCharacter(row: any): Character {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            personality: row.personality,
            scenario: row.scenario,
            firstMessage: row.first_message,
            exampleMessages: row.example_messages,
            systemPrompt: row.system_prompt,
            postHistoryInstructions: row.post_history_instructions,
            creatorNotes: row.creator_notes,
            tags: JSON.parse(row.tags || '[]'),
            avatar: row.avatar,
            alternateGreetings: JSON.parse(row.alternate_greetings || '[]'),
            promptAssemblyOrder: row.prompt_assembly_order ? JSON.parse(row.prompt_assembly_order) : null,
            useProfilePromptOrder: Boolean(row.use_profile_prompt_order),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
