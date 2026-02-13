/**
 * Skills Resolver — determines which skills should be injected into the prompt
 */

import type { SkillEntry, AppConfig } from '@chatbot/types';
import type { SkillRegistry } from './registry.js';

export interface ResolvedSkills {
  /** Skill texts to inject into the system prompt */
  texts: string[];
  /** Names of skills that were resolved */
  names: string[];
}

/**
 * Resolve which skills should be active for the current context.
 */
export function resolveSkills(
  registry: SkillRegistry,
  config: AppConfig,
  _userQuery?: string,
): ResolvedSkills {
  const result: ResolvedSkills = { texts: [], names: [] };
  const skills = registry.list();

  for (const skill of skills) {
    if (!skill.enabled) continue;

    // Check requirements
    if (!checkRequirements(skill, config)) continue;

    // Load content
    const content = registry.loadContent(skill.name);
    if (!content || !content.body) continue;

    result.texts.push(content.body);
    result.names.push(skill.name);
  }

  return result;
}

/** Check if a skill's requirements are met */
function checkRequirements(skill: SkillEntry, config: AppConfig): boolean {
  if (!skill.metadata?.requires) return true;

  // Config requirements
  if (skill.metadata.requires.config) {
    for (const configPath of skill.metadata.requires.config) {
      if (!checkConfigPath(config, configPath)) {
        return false;
      }
    }
  }

  // Binary requirements (simplified — just check they're not empty)
  // In production, this would use `which` or `command -v`
  if (skill.metadata.requires.bins) {
    // Skip binary checks for now — they require system access
  }

  return true;
}

/** Check if a dot-path config value is truthy */
function checkConfigPath(config: AppConfig, path: string): boolean {
  const parts = path.split('.');
  let current: any = config;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return false;
    current = current[part];
  }

  return !!current;
}

/**
 * Format resolved skills for injection into the system prompt.
 */
export function formatSkillsContext(resolved: ResolvedSkills): string {
  if (resolved.texts.length === 0) return '';

  const sections = resolved.texts.map((text, i) => {
    return `### Skill: ${resolved.names[i]}\n${text}`;
  });

  return `\n--- Active Skills ---\n${sections.join('\n\n')}\n--- End Skills ---\n`;
}
