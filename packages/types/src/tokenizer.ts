/**
 * Tokenization System type definitions
 * Phase 7 — Week 20
 */

/**
 * A tokenizer that can encode/decode text to/from token IDs
 */
export interface Tokenizer {
  /** Encode text into token IDs */
  encode(text: string): number[];
  /** Decode token IDs back to text */
  decode(tokens: number[]): string;
  /** Count the number of tokens in text */
  count(text: string): number;
  /** Human-readable name of this tokenizer */
  name: string;
  /** Model family this tokenizer belongs to */
  modelFamily: string;
}

/**
 * Metadata about a tokenizer for registration
 */
export interface TokenizerInfo {
  id: string;
  name: string;
  modelFamily: string;
  /** Model ID patterns this tokenizer should be used for */
  modelPatterns: string[];
  /** Type of tokenizer implementation */
  type: 'tiktoken' | 'sentencepiece' | 'heuristic';
}

/**
 * Token count result for UI display
 */
export interface TokenCountResult {
  /** Token count for each section */
  system: number;
  persona: number;
  memory: number;
  lorebook: number;
  skills: number;
  history: number;
  userMessage: number;
  /** Total tokens used */
  total: number;
  /** Context window limit */
  limit: number;
  /** Whether the tokenizer is exact or approximate */
  isApproximate: boolean;
  /** Name of the tokenizer used */
  tokenizerName: string;
}

/**
 * Request payload for server-side tokenization
 */
export interface TokenizeRequest {
  text: string;
  modelId?: string;
}

/**
 * Response from server-side tokenization
 */
export interface TokenizeResponse {
  count: number;
  tokenizerName: string;
  isApproximate: boolean;
}
