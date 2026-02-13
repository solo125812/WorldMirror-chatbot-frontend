/**
 * Skills System type definitions
 */

export type SkillSource = 'bundled' | 'managed' | 'workspace';

export interface SkillMetadata {
  emoji?: string;
  always?: boolean;
  requires?: {
    config?: string[];
    bins?: string[];
  };
}

export interface SkillEntry {
  name: string;
  description: string;
  filePath: string;
  source: SkillSource;
  metadata?: SkillMetadata;
  enabled: boolean;
}

export interface SkillContent extends SkillEntry {
  /** Full markdown body of the SKILL.md */
  body: string;
}
