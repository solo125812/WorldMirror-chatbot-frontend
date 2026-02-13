/**
 * Unit tests for SkillRegistry scanning and precedence
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillRegistry } from '@chatbot/core';

function makeSkill(dir: string, folder: string, content: string): string {
  const skillDir = join(dir, folder);
  mkdirSync(skillDir, { recursive: true });
  const filePath = join(skillDir, 'SKILL.md');
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('SkillRegistry', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should parse frontmatter and load content', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'skills-'));
    createdDirs.push(baseDir);

    makeSkill(
      baseDir,
      'voice-skill',
      [
        '---',
        'name: "Voice Consistency"',
        'description: "Keep voice stable."',
        'metadata:',
        '  always: false',
        '---',
        'Use a consistent voice throughout the story.',
      ].join('\n'),
    );

    const registry = new SkillRegistry([{ path: baseDir, source: 'bundled' }]);
    const skill = registry.get('Voice Consistency');
    expect(skill).toBeDefined();
    expect(skill?.description).toBe('Keep voice stable.');
    expect(skill?.enabled).toBe(false);

    const content = registry.loadContent('Voice Consistency');
    expect(content?.body).toContain('Use a consistent voice');
    expect(content?.body).not.toContain('metadata:');
  });

  it('should prefer higher-precedence sources for the same skill name', () => {
    const bundledDir = mkdtempSync(join(tmpdir(), 'skills-bundled-'));
    const workspaceDir = mkdtempSync(join(tmpdir(), 'skills-workspace-'));
    createdDirs.push(bundledDir, workspaceDir);

    makeSkill(
      bundledDir,
      'shared',
      [
        '---',
        'name: "Shared Skill"',
        'description: "Bundled description"',
        '---',
        'Bundled body',
      ].join('\n'),
    );

    makeSkill(
      workspaceDir,
      'shared',
      [
        '---',
        'name: "Shared Skill"',
        'description: "Workspace description"',
        '---',
        'Workspace body',
      ].join('\n'),
    );

    const registry = new SkillRegistry([
      { path: bundledDir, source: 'bundled' },
      { path: workspaceDir, source: 'workspace' },
    ]);

    const skill = registry.get('Shared Skill');
    expect(skill).toBeDefined();
    expect(skill?.description).toBe('Workspace description');
    expect(skill?.filePath).toContain(workspaceDir);
  });
});
