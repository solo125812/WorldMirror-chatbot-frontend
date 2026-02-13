/**
 * Slash Command System type definitions
 * Phase 7 — Week 21
 */

/**
 * A parsed slash command from user input
 */
export interface ParsedCommand {
  /** Command name without the leading / */
  name: string;
  /** Named arguments (e.g. --model gpt-4) */
  namedArgs: Record<string, string | boolean>;
  /** Positional arguments */
  positionalArgs: string[];
  /** Raw input string */
  raw: string;
}

/**
 * Definition of a slash command argument
 */
export interface SlashCommandArg {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  required: boolean;
  enumValues?: string[];
  defaultValue?: unknown;
}

/**
 * Definition of a slash command
 */
export interface SlashCommandDef {
  name: string;
  aliases: string[];
  description: string;
  namedArgs: SlashCommandArg[];
  positionalArgs: SlashCommandArg[];
  /** Whether the command requires model invocation */
  requiresModel: boolean;
  /** Category for grouping in help menu */
  category: 'chat' | 'model' | 'navigation' | 'memory' | 'system' | 'plugin';
}

/**
 * Result of executing a slash command
 */
export interface CommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Optional text output from the command */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Side effects the command performed */
  sideEffects?: CommandSideEffect[];
  /** Whether the command should also trigger a model call */
  triggerModelCall?: boolean;
}

export type CommandSideEffect =
  | { type: 'set_model'; modelId: string }
  | { type: 'set_preset'; presetId: string }
  | { type: 'set_system_prompt'; prompt: string }
  | { type: 'inject_message'; role: 'system' | 'user' | 'assistant'; content: string }
  | { type: 'clear_chat' }
  | { type: 'create_branch'; label: string; messageId: string }
  | { type: 'create_checkpoint'; label: string; messageId: string }
  | { type: 'set_variable'; key: string; value: string; scope: 'global' | 'chat' };
