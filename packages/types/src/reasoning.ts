/**
 * Reasoning and Chain-of-Thought Display type definitions
 * Phase 7 — Week 21
 */

/**
 * A reasoning/thinking block extracted from model output
 */
export interface ReasoningBlock {
  /** How the reasoning was obtained */
  type: 'model' | 'parsed' | 'manual' | 'edited';
  /** The reasoning content text */
  content: string;
  /** How long the model "thought" in milliseconds */
  durationMs?: number;
  /** Encrypted signature for Claude extended thinking */
  signature?: string;
}

/**
 * Configuration for reasoning extraction
 */
export interface ReasoningConfig {
  /** Whether reasoning display is enabled */
  enabled: boolean;
  /** Default collapsed/expanded state */
  defaultExpanded: boolean;
  /** Custom regex patterns for parsing reasoning blocks */
  customPatterns?: ReasoningPattern[];
}

/**
 * Pattern for detecting reasoning blocks in text output
 */
export interface ReasoningPattern {
  /** Model family or provider this pattern applies to */
  modelFamily: string;
  /** Opening tag/marker */
  openTag: string;
  /** Closing tag/marker */
  closeTag: string;
  /** Whether to use regex matching */
  isRegex: boolean;
}

/**
 * Token-level probability information
 */
export interface LogprobToken {
  /** The token text */
  token: string;
  /** Log probability of this token */
  logprob: number;
  /** Linear probability (exp(logprob)) */
  probability: number;
  /** Top alternative tokens at this position */
  topLogprobs?: Array<{
    token: string;
    logprob: number;
  }>;
}

/**
 * Logprobs data for a complete message
 */
export interface LogprobsData {
  /** Array of token-level probabilities */
  tokens: LogprobToken[];
  /** Average log probability across all tokens */
  avgLogprob: number;
  /** Total number of tokens */
  totalTokens: number;
}

/**
 * Extended message metadata for Phase 7 features
 */
export interface Phase7MessageMetadata {
  /** Reasoning/thinking blocks if present */
  reasoning?: ReasoningBlock[];
  /** Token-level probabilities if provider supports them */
  logprobs?: LogprobsData;
  /** Token usage counters for this message */
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}
