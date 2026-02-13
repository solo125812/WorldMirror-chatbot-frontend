/**
 * Unit tests for Auto-Capture Rules
 */

import { describe, it, expect } from 'vitest';
import {
  scanForCaptures,
  DEFAULT_AUTO_CAPTURE_CONFIG,
  DEFAULT_TRIGGERS,
} from '@chatbot/memory';

describe('scanForCaptures', () => {
  it('should return empty array when disabled', () => {
    const result = scanForCaptures('I prefer dark mode.', {
      ...DEFAULT_AUTO_CAPTURE_CONFIG,
      enabled: false,
    });
    expect(result).toEqual([]);
  });

  it('should detect explicit remember requests', () => {
    const result = scanForCaptures(
      'Please remember this: my API key is stored in the env file.',
      DEFAULT_AUTO_CAPTURE_CONFIG
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBe('fact');
    expect(result[0].triggerId).toBe('remember');
  });

  it('should detect user preferences', () => {
    const result = scanForCaptures(
      'I prefer TypeScript over JavaScript for large projects.',
      DEFAULT_AUTO_CAPTURE_CONFIG
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBe('preference');
  });

  it('should detect decisions', () => {
    const result = scanForCaptures(
      "We decided to use PostgreSQL for the production database.",
      DEFAULT_AUTO_CAPTURE_CONFIG
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBe('decision');
  });

  it('should detect email addresses', () => {
    const result = scanForCaptures(
      'You can reach me at john.doe@example.com anytime.',
      DEFAULT_AUTO_CAPTURE_CONFIG
    );
    expect(result.length).toBeGreaterThan(0);
    const emailCapture = result.find((r) => r.triggerId === 'email');
    expect(emailCapture).toBeDefined();
    expect(emailCapture!.category).toBe('entity');
  });

  it('should respect maxPerTurn limit', () => {
    const text =
      'I prefer dark mode. I like Python. I love JavaScript. I want TypeScript. I need REST APIs.';
    const result = scanForCaptures(text, {
      ...DEFAULT_AUTO_CAPTURE_CONFIG,
      maxPerTurn: 2,
    });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('should not duplicate captures from same sentence', () => {
    const result = scanForCaptures(
      'I prefer and I like dark mode a lot.',
      DEFAULT_AUTO_CAPTURE_CONFIG
    );
    // Both "i prefer" and "i like" match the same trigger
    // But they should not create duplicate entries for the same sentence
    const uniqueContents = new Set(result.map((r) => r.content));
    expect(uniqueContents.size).toBe(result.length);
  });

  it('should capture identity statements', () => {
    const result = scanForCaptures(
      'I am a software engineer working on cloud infrastructure.',
      DEFAULT_AUTO_CAPTURE_CONFIG
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBe('entity');
  });

  it('should skip disabled triggers', () => {
    const config = {
      ...DEFAULT_AUTO_CAPTURE_CONFIG,
      triggers: DEFAULT_TRIGGERS.map((t) => ({
        ...t,
        enabled: t.id !== 'preference',
      })),
    };

    const result = scanForCaptures(
      'I prefer dark mode.',
      config
    );
    // The preference trigger is disabled
    const preferenceCapture = result.find((r) => r.triggerId === 'preference');
    expect(preferenceCapture).toBeUndefined();
  });

  it('should handle text with no matches', () => {
    const result = scanForCaptures(
      'The weather is nice today. How are you doing?',
      DEFAULT_AUTO_CAPTURE_CONFIG
    );
    expect(result).toEqual([]);
  });

  it('should extract the containing sentence', () => {
    const result = scanForCaptures(
      'First sentence. I prefer using Vim for editing. Last sentence.',
      DEFAULT_AUTO_CAPTURE_CONFIG
    );
    expect(result.length).toBeGreaterThan(0);
    // The captured content should be the full sentence, not just the match
    expect(result[0].content).toContain('Vim');
    expect(result[0].content).toContain('prefer');
  });
});

describe('DEFAULT_TRIGGERS', () => {
  it('should have 7 default triggers', () => {
    expect(DEFAULT_TRIGGERS).toHaveLength(7);
  });

  it('should all be enabled by default', () => {
    for (const trigger of DEFAULT_TRIGGERS) {
      expect(trigger.enabled).toBe(true);
    }
  });

  it('should have unique IDs', () => {
    const ids = DEFAULT_TRIGGERS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have valid regex patterns', () => {
    for (const trigger of DEFAULT_TRIGGERS) {
      expect(() => new RegExp(trigger.pattern, 'gi')).not.toThrow();
    }
  });
});
