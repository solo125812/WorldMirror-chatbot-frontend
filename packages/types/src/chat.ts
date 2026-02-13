/**
 * Chat-related type definitions
 */

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  activeSwipeIndex?: number;
}

export interface Chat {
  id: string;
  title: string;
  characterId?: string;
  activeModelId?: string;
  samplerPresetId?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
  /** Phase 7: Parent chat ID if this is a branch */
  parentChatId?: string;
  /** Phase 7: Message ID at which this branch diverges */
  branchPointMessageId?: string;
  /** Phase 7: Root chat of the branch tree */
  rootChatId?: string;
  /** Phase 7: User-assigned branch label */
  branchLabel?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  modelId?: string;
  stream?: boolean;
  systemPrompt?: string;
}

export type ChatStreamEventType = 'token' | 'done' | 'error' | 'reasoning' | 'logprobs' | 'command';

export interface TokenEvent {
  type: 'token';
  value: string;
}

export interface DoneEvent {
  type: 'done';
  messageId?: string;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

/** Phase 7: Reasoning/thinking block streamed from model */
export interface ReasoningEvent {
  type: 'reasoning';
  content: string;
  durationMs?: number;
}

/** Phase 7: Token-level probability data */
export interface LogprobsEvent {
  type: 'logprobs';
  tokens: Array<{ token: string; logprob: number }>;
}

/** Phase 7: Slash command execution result */
export interface CommandEvent {
  type: 'command';
  name: string;
  success: boolean;
  output?: string;
  error?: string;
}

export type ChatStreamEvent = TokenEvent | DoneEvent | ErrorEvent | ReasoningEvent | LogprobsEvent | CommandEvent;
