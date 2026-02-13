/**
 * Unit tests for Skills Resolver
 */

import { describe, it, expect } from 'vitest';
import { resolveSkills, formatSkillsContext } from '@chatbot/core';
import type { ResolvedSkills } from '@chatbot/core';
import { SkillRegistry } from '@chatbot/core';
import type { AppConfig } from '@chatbot/types';

// We can't easily test SkillRegistry.scan() without a filesystem,
// but we can test resolveSkills and formatSkillsContext

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    providers: [],
    activeModelId: 'mock-1',
    prompt: {
      systemPrompt: 'You are a helpful assistant.',
      assemblyOrder: ['system', 'history', 'user'],
    },
    memory: {},
    server: { port: 3000, host: '0.0.0.0' },
    features: { lorebook: true, groupChat: true, skills: true, triggers: true },
    ...overrides,
  };
}

describe('formatSkillsContext', () => {
  it('should return empty string when no skills resolved', () => {
    const resolved: ResolvedSkills = { texts: [], names: [] };
    expect(formatSkillsContext(resolved)).toBe('');
  });

  it('should format skills with headers', () => {
    const resolved: ResolvedSkills = {
      texts: ['Be consistent with character voice.', 'Use vivid descriptions.'],
      names: ['Voice Consistency', 'Narrative Style'],
    };

    const result = formatSkillsContext(resolved);
    expect(result).toContain('### Skill: Voice Consistency');
    expect(result).toContain('Be consistent with character voice.');
    expect(result).toContain('### Skill: Narrative Style');
    expect(result).toContain('Use vivid descriptions.');
    expect(result).toContain('--- Active Skills ---');
    expect(result).toContain('--- End Skills ---');
  });
});

describe('resolveSkills', () => {
  it('should return empty when registry has no skills', () => {
    // Create a registry with non-existent directories
    const registry = new SkillRegistry([
      { path: '/nonexistent/path/skills', source: 'bundled' },
    ]);

    const config = makeConfig();
    const result = resolveSkills(registry, config);
    expect(result.texts).toHaveLength(0);
    expect(result.names).toHaveLength(0);
  });
});
