/**
 * Mock LLM Provider — streams fixed tokens for testing
 */

import type { ChatMessage, LLMProvider, ModelInfo, CompletionParams, StreamChunk, HealthResult } from '@chatbot/types';

const MOCK_RESPONSES = [
  "Hello! I'm a mock AI assistant. I'm here to help you test the chat interface. How can I assist you today?",
  "That's a great question! Let me think about it for a moment... I believe the answer involves considering multiple perspectives and weighing the evidence carefully.",
  "I understand what you're asking. Here's my analysis: the key factors to consider are the context, the constraints, and the desired outcome. Would you like me to elaborate on any of these points?",
  "Interesting! I've processed your request and here are my thoughts on the matter. The most important thing to remember is that this is a mock response for testing purposes.",
];

export class MockProvider implements LLMProvider {
  id = 'mock';
  name = 'Mock Provider';
  type = 'mock';

  private responseIndex = 0;

  async *createChatCompletion(
    messages: ChatMessage[],
    params: CompletionParams
  ): AsyncIterable<StreamChunk> {
    const response = MOCK_RESPONSES[this.responseIndex % MOCK_RESPONSES.length];
    this.responseIndex++;

    // Simulate streaming by yielding one word at a time
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));

      const token = i === 0 ? words[i] : ' ' + words[i];
      yield { type: 'token' as const, value: token };
    }

    yield { type: 'done' as const };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'mock-model-1',
        name: 'Mock Model',
        providerId: 'mock',
        contextWindow: 4096,
        supportsTools: false,
        supportsVision: false,
        supportsStreaming: true,
      },
    ];
  }

  async healthCheck(): Promise<HealthResult> {
    return { ok: true, latencyMs: 1 };
  }
}
