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
}

export interface ChatRequest {
  messages: ChatMessage[];
  modelId?: string;
  stream?: boolean;
  systemPrompt?: string;
}

export type ChatStreamEventType = 'token' | 'done' | 'error';

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

export type ChatStreamEvent = TokenEvent | DoneEvent | ErrorEvent;
