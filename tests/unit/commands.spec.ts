/**
 * Unit tests for Slash Command Parser
 * Phase 7 — Week 21
 */

import { describe, it, expect } from 'vitest';
import {
  isCommand,
  parseCommand,
  splitPipedCommands,
  getAutocompleteSuggestions,
  BUILTIN_COMMANDS,
} from '@chatbot/core';

describe('isCommand', () => {
  it('returns true for valid commands', () => {
    expect(isCommand('/send hello')).toBe(true);
    expect(isCommand('/model gpt-4')).toBe(true);
    expect(isCommand('/help')).toBe(true);
  });

  it('returns false for non-commands', () => {
    expect(isCommand('hello')).toBe(false);
    expect(isCommand('/ not a command')).toBe(false);
    expect(isCommand('/123')).toBe(false);
    expect(isCommand('')).toBe(false);
  });

  it('handles leading whitespace', () => {
    expect(isCommand('  /send hello')).toBe(true);
  });
});

describe('parseCommand', () => {
  it('parses a simple command with no args', () => {
    const parsed = parseCommand('/help');
    expect(parsed.name).toBe('help');
    expect(parsed.positionalArgs).toEqual([]);
    expect(parsed.namedArgs).toEqual({});
  });

  it('parses a command with positional args', () => {
    const parsed = parseCommand('/send Hello World');
    expect(parsed.name).toBe('send');
    expect(parsed.positionalArgs).toEqual(['Hello', 'World']);
  });

  it('parses a command with named args', () => {
    const parsed = parseCommand('/branch --label "my branch"');
    expect(parsed.name).toBe('branch');
    expect(parsed.namedArgs.label).toBe('my branch');
  });

  it('parses boolean flags', () => {
    const parsed = parseCommand('/model gpt-4 --verbose');
    expect(parsed.name).toBe('model');
    expect(parsed.positionalArgs).toEqual(['gpt-4']);
    expect(parsed.namedArgs.verbose).toBe(true);
  });

  it('handles quoted strings with single quotes', () => {
    const parsed = parseCommand("/send 'hello world'");
    expect(parsed.positionalArgs).toEqual(['hello world']);
  });

  it('handles mixed named and positional args', () => {
    const parsed = parseCommand('/memory search query --limit 10');
    expect(parsed.name).toBe('memory');
    expect(parsed.positionalArgs).toEqual(['search', 'query']);
    expect(parsed.namedArgs.limit).toBe('10');
  });

  it('normalizes command name to lowercase', () => {
    const parsed = parseCommand('/HELP');
    expect(parsed.name).toBe('help');
  });

  it('handles non-command input', () => {
    const parsed = parseCommand('just regular text');
    expect(parsed.name).toBe('');
    expect(parsed.positionalArgs).toEqual(['just regular text']);
  });

  it('preserves raw input', () => {
    const input = '/send Hello World';
    const parsed = parseCommand(input);
    expect(parsed.raw).toBe(input);
  });
});

describe('splitPipedCommands', () => {
  it('splits simple piped commands', () => {
    const parts = splitPipedCommands('/cmd1 arg | /cmd2');
    expect(parts).toEqual(['/cmd1 arg', '/cmd2']);
  });

  it('handles single command without pipe', () => {
    const parts = splitPipedCommands('/help');
    expect(parts).toEqual(['/help']);
  });

  it('respects quoted strings containing pipes', () => {
    const parts = splitPipedCommands('/send "hello | world"');
    expect(parts).toEqual(['/send "hello | world"']);
  });

  it('handles multiple pipes', () => {
    const parts = splitPipedCommands('/a | /b | /c');
    expect(parts).toEqual(['/a', '/b', '/c']);
  });
});

describe('getAutocompleteSuggestions', () => {
  it('suggests matching commands', () => {
    const suggestions = getAutocompleteSuggestions('/se', BUILTIN_COMMANDS);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.find((s) => s.name === 'send')).toBeDefined();
    expect(suggestions.find((s) => s.name === 'setvar')).toBeDefined();
  });

  it('returns empty for non-command input', () => {
    expect(getAutocompleteSuggestions('hello', BUILTIN_COMMANDS)).toEqual([]);
  });

  it('matches by prefix', () => {
    const suggestions = getAutocompleteSuggestions('/he', BUILTIN_COMMANDS);
    expect(suggestions.find((s) => s.name === 'help')).toBeDefined();
  });

  it('limits to 10 results', () => {
    const suggestions = getAutocompleteSuggestions('/', BUILTIN_COMMANDS);
    expect(suggestions.length).toBeLessThanOrEqual(10);
  });
});

describe('BUILTIN_COMMANDS', () => {
  it('contains expected commands', () => {
    const names = BUILTIN_COMMANDS.map((c) => c.name);
    expect(names).toContain('send');
    expect(names).toContain('continue');
    expect(names).toContain('model');
    expect(names).toContain('help');
    expect(names).toContain('branch');
    expect(names).toContain('checkpoint');
    expect(names).toContain('clear');
    expect(names).toContain('memory');
  });

  it('has descriptions for all commands', () => {
    for (const cmd of BUILTIN_COMMANDS) {
      expect(cmd.description).toBeTruthy();
    }
  });

  it('has categories for all commands', () => {
    for (const cmd of BUILTIN_COMMANDS) {
      expect(['chat', 'model', 'navigation', 'memory', 'system', 'plugin']).toContain(cmd.category);
    }
  });
});
