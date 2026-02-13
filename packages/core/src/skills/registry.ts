/**
 * Skills Registry — scans directories for SKILL.md files and builds an index
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { SkillEntry, SkillContent, SkillSource, SkillMetadata } from '@chatbot/types';

export class SkillRegistry {
  private skills: Map<string, SkillEntry> = new Map();

  constructor(private directories: Array<{ path: string; source: SkillSource }>) {
    this.scan();
  }

  /** Scan all configured directories for SKILL.md files */
  scan(): void {
    this.skills.clear();

    for (const { path: dir, source } of this.directories) {
      if (!existsSync(dir)) continue;

      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const skillPath = join(dir, entry.name, 'SKILL.md');
          if (!existsSync(skillPath)) continue;

          try {
            const header = this.parseHeader(skillPath);
            const skill: SkillEntry = {
              name: header.name || entry.name,
              description: header.description || '',
              filePath: skillPath,
              source,
              metadata: header.metadata,
              enabled: header.metadata?.always ?? true,
            };

            // Precedence: workspace > managed > bundled
            const existing = this.skills.get(skill.name);
            if (!existing || sourcePrecedence(source) > sourcePrecedence(existing.source)) {
              this.skills.set(skill.name, skill);
            }
          } catch {
            // Skip invalid skill files
          }
        }
      } catch {
        // Directory read failed — skip
      }
    }
  }

  /** Get all registered skills */
  list(): SkillEntry[] {
    return [...this.skills.values()];
  }

  /** Alias for list() — get all registered skills */
  listAll(): SkillEntry[] {
    return this.list();
  }

  /** Get a skill by name */
  get(name: string): SkillEntry | undefined {
    return this.skills.get(name);
  }

  /** Load the full content of a skill */
  loadContent(name: string): SkillContent | null {
    const entry = this.skills.get(name);
    if (!entry) return null;

    try {
      const raw = readFileSync(entry.filePath, 'utf-8');
      const body = this.stripFrontmatter(raw);
      return { ...entry, body };
    } catch {
      return null;
    }
  }

  /** Toggle a skill's enabled state */
  setEnabled(name: string, enabled: boolean): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;
    skill.enabled = enabled;
    return true;
  }

  /** Parse YAML frontmatter from a SKILL.md file (lazy header-only read) */
  private parseHeader(filePath: string): {
    name?: string;
    description?: string;
    metadata?: SkillMetadata;
  } {
    const raw = readFileSync(filePath, 'utf-8');

    // Check for YAML frontmatter
    if (!raw.startsWith('---')) {
      return {};
    }

    const endIndex = raw.indexOf('---', 3);
    if (endIndex === -1) return {};

    const frontmatter = raw.substring(3, endIndex).trim();
    return parseSimpleYaml(frontmatter);
  }

  /** Strip YAML frontmatter from markdown content */
  private stripFrontmatter(raw: string): string {
    if (!raw.startsWith('---')) return raw;
    const endIndex = raw.indexOf('---', 3);
    if (endIndex === -1) return raw;
    return raw.substring(endIndex + 3).trim();
  }
}

/** Simple YAML parser for skill frontmatter (no external dependency) */
function parseSimpleYaml(yaml: string): {
  name?: string;
  description?: string;
  metadata?: SkillMetadata;
} {
  const result: any = {};
  const lines = yaml.split('\n');

  let currentKey = '';
  let inMetadata = false;
  let inRequires = false;
  const metadata: SkillMetadata = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Top-level key
    const topMatch = line.match(/^(\w+):\s*(.*)/);
    if (topMatch) {
      const [, key, value] = topMatch;
      currentKey = key;

      if (key === 'metadata') {
        inMetadata = true;
        inRequires = false;
        continue;
      }

      inMetadata = false;
      inRequires = false;

      if (value) {
        result[key] = value.replace(/^["']|["']$/g, '');
      }
      continue;
    }

    // Metadata sub-keys
    if (inMetadata) {
      const metaMatch = trimmed.match(/^(\w+):\s*(.*)/);
      if (metaMatch) {
        const [, key, value] = metaMatch;
        if (key === 'emoji') {
          metadata.emoji = value.replace(/^["']|["']$/g, '');
        } else if (key === 'always') {
          metadata.always = value === 'true';
        } else if (key === 'requires') {
          inRequires = true;
          metadata.requires = {};
        }
        continue;
      }

      // Requires sub-keys
      if (inRequires) {
        const reqMatch = trimmed.match(/^(\w+):\s*\[(.*)\]/);
        if (reqMatch) {
          const [, key, values] = reqMatch;
          const arr = values.split(',').map((v) => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
          if (key === 'config') {
            metadata.requires = { ...metadata.requires, config: arr };
          } else if (key === 'bins') {
            metadata.requires = { ...metadata.requires, bins: arr };
          }
        }
      }
    }
  }

  if (Object.keys(metadata).length > 0) {
    result.metadata = metadata;
  }

  return result;
}

function sourcePrecedence(source: SkillSource): number {
  switch (source) {
    case 'bundled': return 0;
    case 'managed': return 1;
    case 'workspace': return 2;
    default: return -1;
  }
}
