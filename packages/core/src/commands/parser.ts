/**
 * Slash Command Parser — Parse user input into command AST
 * Phase 7 — Week 21
 *
 * Parses user-typed commands like "/model gpt-4" or "/branch --label 'my branch'"
 * into structured ParsedCommand objects for execution.
 */

import type { ParsedCommand, SlashCommandDef } from '@chatbot/types';

/**
 * Check if a string starts with a slash command.
 */
export function isCommand(input: string): boolean {
  return /^\/[a-zA-Z]/.test(input.trim());
}

/**
 * Parse a slash command string into a structured ParsedCommand.
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  if (!isCommand(trimmed)) {
    return {
      name: '',
      namedArgs: {},
      positionalArgs: [trimmed],
      raw: input,
    };
  }

  // Remove the leading /
  const withoutSlash = trimmed.slice(1);

  // Extract command name (first word)
  const spaceIdx = withoutSlash.indexOf(' ');
  const name = spaceIdx === -1 ? withoutSlash : withoutSlash.slice(0, spaceIdx);
  const argsStr = spaceIdx === -1 ? '' : withoutSlash.slice(spaceIdx + 1).trim();

  // Parse arguments
  const namedArgs: Record<string, string | boolean> = {};
  const positionalArgs: string[] = [];

  if (argsStr) {
    const tokens = tokenize(argsStr);
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token.startsWith('--')) {
        const key = token.slice(2);
        // Check if next token is a value (not another flag)
        if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
          namedArgs[key] = tokens[i + 1];
          i += 2;
        } else {
          namedArgs[key] = true;
          i += 1;
        }
      } else {
        positionalArgs.push(token);
        i += 1;
      }
    }
  }

  return {
    name: name.toLowerCase(),
    namedArgs,
    positionalArgs,
    raw: input,
  };
}

/**
 * Tokenize an argument string, respecting quoted strings.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Split a piped command string into individual commands.
 * E.g. "/cmd1 arg | /cmd2" → ["/cmd1 arg", "/cmd2"]
 */
export function splitPipedCommands(input: string): string[] {
  // Split on | but not inside quotes
  const parts: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (const ch of input) {
    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      current += ch;
      inQuote = ch;
    } else if (ch === '|') {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.filter(Boolean);
}

/**
 * Generate autocomplete suggestions for a partial command input.
 */
export function getAutocompleteSuggestions(
  partial: string,
  commands: SlashCommandDef[],
): Array<{ name: string; description: string; aliases: string[] }> {
  if (!partial.startsWith('/')) return [];

  const query = partial.slice(1).toLowerCase();

  return commands
    .filter((cmd) => {
      if (cmd.name.startsWith(query)) return true;
      return cmd.aliases.some((a) => a.startsWith(query));
    })
    .map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      aliases: cmd.aliases,
    }))
    .slice(0, 10); // Limit to 10 suggestions
}

// ─── Built-in Command Definitions ────────────────────────────────

export const BUILTIN_COMMANDS: SlashCommandDef[] = [
  {
    name: 'send',
    aliases: ['s'],
    description: 'Send a message as the user',
    positionalArgs: [{ name: 'text', description: 'Message text', type: 'string', required: true }],
    namedArgs: [],
    requiresModel: true,
    category: 'chat',
  },
  {
    name: 'continue',
    aliases: ['cont'],
    description: 'Continue the last AI response',
    positionalArgs: [],
    namedArgs: [],
    requiresModel: true,
    category: 'chat',
  },
  {
    name: 'regenerate',
    aliases: ['regen'],
    description: 'Regenerate the last AI response',
    positionalArgs: [],
    namedArgs: [],
    requiresModel: true,
    category: 'chat',
  },
  {
    name: 'stop',
    aliases: [],
    description: 'Stop current generation',
    positionalArgs: [],
    namedArgs: [],
    requiresModel: false,
    category: 'chat',
  },
  {
    name: 'sys',
    aliases: ['system'],
    description: 'Send a system message',
    positionalArgs: [{ name: 'text', description: 'System message text', type: 'string', required: true }],
    namedArgs: [],
    requiresModel: false,
    category: 'chat',
  },
  {
    name: 'model',
    aliases: ['m'],
    description: 'Switch the active model',
    positionalArgs: [{ name: 'id', description: 'Model ID', type: 'string', required: true }],
    namedArgs: [],
    requiresModel: false,
    category: 'model',
  },
  {
    name: 'preset',
    aliases: [],
    description: 'Switch sampler preset',
    positionalArgs: [{ name: 'name', description: 'Preset name or ID', type: 'string', required: true }],
    namedArgs: [],
    requiresModel: false,
    category: 'model',
  },
  {
    name: 'persona',
    aliases: [],
    description: 'Switch active persona/character',
    positionalArgs: [{ name: 'name', description: 'Persona name', type: 'string', required: true }],
    namedArgs: [],
    requiresModel: false,
    category: 'navigation',
  },
  {
    name: 'branch',
    aliases: ['fork'],
    description: 'Create a new conversation branch from the current message',
    positionalArgs: [],
    namedArgs: [{ name: 'label', description: 'Branch label', type: 'string', required: false }],
    requiresModel: false,
    category: 'navigation',
  },
  {
    name: 'checkpoint',
    aliases: ['bookmark'],
    description: 'Create a checkpoint at the current position',
    positionalArgs: [],
    namedArgs: [{ name: 'label', description: 'Checkpoint label', type: 'string', required: false }],
    requiresModel: false,
    category: 'navigation',
  },
  {
    name: 'restore',
    aliases: [],
    description: 'Restore from a checkpoint',
    positionalArgs: [{ name: 'id', description: 'Checkpoint ID or label', type: 'string', required: true }],
    namedArgs: [],
    requiresModel: false,
    category: 'navigation',
  },
  {
    name: 'tokens',
    aliases: ['tc'],
    description: 'Show current token count breakdown',
    positionalArgs: [],
    namedArgs: [],
    requiresModel: false,
    category: 'system',
  },
  {
    name: 'clear',
    aliases: [],
    description: 'Clear chat history',
    positionalArgs: [],
    namedArgs: [],
    requiresModel: false,
    category: 'system',
  },
  {
    name: 'help',
    aliases: ['?'],
    description: 'Show available commands',
    positionalArgs: [{ name: 'command', description: 'Command to get help for', type: 'string', required: false }],
    namedArgs: [],
    requiresModel: false,
    category: 'system',
  },
  {
    name: 'memory',
    aliases: ['mem'],
    description: 'Search long-term memory',
    positionalArgs: [{ name: 'query', description: 'Search query', type: 'string', required: true }],
    namedArgs: [
      { name: 'limit', description: 'Max results', type: 'number', required: false, defaultValue: 5 },
    ],
    requiresModel: false,
    category: 'memory',
  },
  {
    name: 'setvar',
    aliases: [],
    description: 'Set a chat or global variable',
    positionalArgs: [
      { name: 'key', description: 'Variable name', type: 'string', required: true },
      { name: 'value', description: 'Variable value', type: 'string', required: true },
    ],
    namedArgs: [
      { name: 'scope', description: 'Variable scope', type: 'enum', required: false, enumValues: ['chat', 'global'], defaultValue: 'chat' },
    ],
    requiresModel: false,
    category: 'system',
  },
  {
    name: 'getvar',
    aliases: [],
    description: 'Get a variable value',
    positionalArgs: [{ name: 'key', description: 'Variable name', type: 'string', required: true }],
    namedArgs: [],
    requiresModel: false,
    category: 'system',
  },
];
