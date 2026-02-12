/**
 * Chat store — Svelte 5 reactive state for chat
 */

import { streamChat } from '../api/stream';

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  streaming?: boolean;
}

function createChatStore() {
  let messages = $state<UIMessage[]>([]);
  let chatId = $state<string | undefined>(undefined);
  let isStreaming = $state(false);
  let error = $state<string | null>(null);

  function makeId() {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming) return;

    error = null;

    // Add user message
    const userMsg: UIMessage = {
      id: makeId(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    messages = [...messages, userMsg];

    // Add placeholder for assistant
    const assistantId = makeId();
    const assistantMsg: UIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      streaming: true,
    };
    messages = [...messages, assistantMsg];
    isStreaming = true;

    try {
      await streamChat(
        content.trim(),
        chatId,
        // onToken
        (token: string) => {
          messages = messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + token }
              : m
          );
        },
        // onDone
        (newChatId: string) => {
          chatId = newChatId;
          messages = messages.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false }
              : m
          );
          isStreaming = false;
        },
        // onError
        (errMsg: string) => {
          error = errMsg;
          messages = messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || 'Error: ' + errMsg, streaming: false }
              : m
          );
          isStreaming = false;
        }
      );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      error = errMsg;
      messages = messages.map((m) =>
        m.id === assistantId
          ? { ...m, content: 'Error: ' + errMsg, streaming: false }
          : m
      );
      isStreaming = false;
    }
  }

  function clearChat() {
    messages = [];
    chatId = undefined;
    error = null;
    isStreaming = false;
  }

  return {
    get messages() { return messages; },
    get chatId() { return chatId; },
    get isStreaming() { return isStreaming; },
    get error() { return error; },
    sendMessage,
    clearChat,
  };
}

export const chatStore = createChatStore();
