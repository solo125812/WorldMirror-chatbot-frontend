/**
 * Instruct Mode and Prompt Format type definitions
 * Phase 7 — Week 20
 */

/**
 * An instruct template defines how chat messages are formatted
 * into text for text-completion backends (KoboldAI, Oobabooga, etc.).
 * Chat-completion APIs (OpenAI, Anthropic) handle formatting internally.
 */
export interface InstructTemplate {
  id: string;
  name: string;
  /** e.g. "<|im_start|>system\n" */
  systemPrefix: string;
  /** e.g. "<|im_end|>\n" */
  systemSuffix: string;
  /** e.g. "<|im_start|>user\n" */
  userPrefix: string;
  /** e.g. "<|im_end|>\n" */
  userSuffix: string;
  /** e.g. "<|im_start|>assistant\n" */
  assistantPrefix: string;
  /** e.g. "<|im_end|>\n" */
  assistantSuffix: string;
  /** Override for first user message if different */
  firstUserPrefix?: string;
  /** Override for final assistant turn (generation prompt) */
  lastAssistantPrefix?: string;
  /** Sequences that signal stop of generation, e.g. ["<|im_end|>"] */
  stopSequences: string[];
  /** Whether to wrap the entire prompt in template markers */
  wrapSequence: boolean;
  /** Source of the template */
  source: 'builtin' | 'user' | 'imported';
}

/**
 * A saved instruct preset that can be selected in the UI
 */
export interface InstructPreset {
  id: string;
  name: string;
  description: string;
  template: InstructTemplate;
  /** Model patterns that auto-select this preset */
  modelPatterns?: string[];
}

/**
 * Model-to-instruct mapping for auto-detection
 */
export interface InstructModelMapping {
  /** Regex pattern to match model ID */
  pattern: string;
  /** ID of the instruct preset to use */
  presetId: string;
}
