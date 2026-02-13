/**
 * Prompt Formatter — Converts chat messages to instruct-formatted text
 * Phase 7 — Week 20
 *
 * Used for text-completion backends (KoboldAI, Oobabooga, local models)
 * that require explicit prompt formatting. Chat-completion APIs handle
 * formatting internally.
 */

import type { ChatMessage } from '@chatbot/types';
import type { InstructTemplate } from '@chatbot/types';

export interface FormatOptions {
  /** Whether to include a trailing assistant prefix (generation prompt) */
  appendGenerationPrompt?: boolean;
  /** System prompt to prepend (overrides system messages in chat) */
  systemPrompt?: string;
}

/**
 * Format an array of chat messages into instruct-formatted text
 * using the specified template.
 */
export function formatChatToInstruct(
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>,
  template: InstructTemplate,
  options: FormatOptions = {},
): string {
  const parts: string[] = [];
  const { appendGenerationPrompt = true, systemPrompt } = options;

  // If a system prompt override is provided, inject it first
  if (systemPrompt) {
    parts.push(template.systemPrefix + systemPrompt + template.systemSuffix);
  }

  let isFirstUser = true;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isLast = i === messages.length - 1;

    switch (msg.role) {
      case 'system':
        // Only emit system messages if no override system prompt was provided
        if (!systemPrompt) {
          parts.push(template.systemPrefix + msg.content + template.systemSuffix);
        }
        break;

      case 'user': {
        const prefix =
          isFirstUser && template.firstUserPrefix
            ? template.firstUserPrefix
            : template.userPrefix;
        parts.push(prefix + msg.content + template.userSuffix);
        isFirstUser = false;
        break;
      }

      case 'assistant': {
        const prefix =
          isLast && template.lastAssistantPrefix
            ? template.lastAssistantPrefix
            : template.assistantPrefix;
        parts.push(prefix + msg.content + template.assistantSuffix);
        break;
      }

      case 'tool':
        // Tool results are formatted as system context
        parts.push(template.systemPrefix + `[Tool Result]\n${msg.content}` + template.systemSuffix);
        break;

      default:
        // Unknown role, emit as-is
        parts.push(msg.content);
        break;
    }
  }

  // Append the assistant prefix as a generation prompt
  if (appendGenerationPrompt) {
    const lastMsg = messages[messages.length - 1];
    // Only append if the last message isn't already an assistant message
    if (!lastMsg || lastMsg.role !== 'assistant') {
      const prefix = template.lastAssistantPrefix ?? template.assistantPrefix;
      parts.push(prefix);
    }
  }

  return parts.join('');
}

/**
 * Parse instruct-formatted text back into chat messages.
 * Best-effort parsing — may not perfectly reconstruct all messages.
 */
export function parseInstructToChat(
  text: string,
  template: InstructTemplate,
): Array<Pick<ChatMessage, 'role' | 'content'>> {
  const messages: Array<Pick<ChatMessage, 'role' | 'content'>> = [];

  // Build a regex that splits on role prefixes
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const prefixes = [
    { role: 'system' as const, prefix: template.systemPrefix, suffix: template.systemSuffix },
    { role: 'user' as const, prefix: template.userPrefix, suffix: template.userSuffix },
    { role: 'assistant' as const, prefix: template.assistantPrefix, suffix: template.assistantSuffix },
  ].filter((p) => p.prefix.length > 0);

  if (prefixes.length === 0) {
    // No prefixes to split on, return entire text as a single message
    return [{ role: 'user', content: text.trim() }];
  }

  // Create a splitting pattern
  const splitPattern = new RegExp(
    `(${prefixes.map((p) => escapeRegex(p.prefix)).join('|')})`,
    'g',
  );

  const parts = text.split(splitPattern).filter(Boolean);

  let currentRole: 'system' | 'user' | 'assistant' | undefined;

  for (const part of parts) {
    const matchedPrefix = prefixes.find((p) => p.prefix === part);
    if (matchedPrefix) {
      currentRole = matchedPrefix.role;
    } else if (currentRole) {
      // Remove the suffix from the content
      const matchedPrefixEntry = prefixes.find((p) => p.role === currentRole);
      let content = part;
      if (matchedPrefixEntry && content.endsWith(matchedPrefixEntry.suffix)) {
        content = content.slice(0, -matchedPrefixEntry.suffix.length);
      }
      content = content.trim();
      if (content) {
        messages.push({ role: currentRole, content });
      }
      currentRole = undefined;
    }
  }

  return messages;
}

/**
 * Detect which instruct format a text string is likely using.
 * Returns the template ID or null if unrecognized.
 */
export function detectFormat(text: string): string | null {
  const patterns: Array<{ id: string; marker: string }> = [
    { id: 'chatml', marker: '<|im_start|>' },
    { id: 'llama3', marker: '<|start_header_id|>' },
    { id: 'alpaca', marker: '### Instruction:' },
    { id: 'vicuna', marker: 'USER: ' },
    { id: 'mistral', marker: '[INST]' },
    { id: 'phi', marker: '<|user|>' },
    { id: 'gemma', marker: '<start_of_turn>' },
    { id: 'command-r', marker: '<|START_OF_TURN_TOKEN|>' },
  ];

  for (const { id, marker } of patterns) {
    if (text.includes(marker)) {
      return id;
    }
  }

  return null;
}
