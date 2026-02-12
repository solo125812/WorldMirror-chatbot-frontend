/**
 * Anthropic Provider — Adapter for the Anthropic Messages API
 */

import type { ChatMessage, CompletionParams, ModelInfo, HealthResult, StreamChunk, LLMProvider } from '@chatbot/types';
import { logger } from '@chatbot/utils';

export class AnthropicProvider implements LLMProvider {
    readonly id = 'anthropic';
    readonly name = 'Anthropic';
    readonly type = 'anthropic';

    private apiKey: string;
    private baseUrl: string;

    constructor(opts: { apiKey: string; baseUrl?: string }) {
        this.apiKey = opts.apiKey;
        this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
    }

    async *createChatCompletion(
        messages: ChatMessage[],
        params: CompletionParams,
    ): AsyncIterable<StreamChunk> {
        const body = this.buildRequestBody(messages, params);

        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({ ...body, stream: true }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Anthropic API error', { status: response.status, error: errorText });
            yield { type: 'error', message: `Anthropic API error: ${response.status}` };
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            yield { type: 'error', message: 'No response body' };
            return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const event = JSON.parse(data);

                        if (event.type === 'content_block_delta' && event.delta?.text) {
                            yield { type: 'token', value: event.delta.text };
                        } else if (event.type === 'message_stop') {
                            yield { type: 'done' };
                        }
                    } catch {
                        // Skip malformed events
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        yield { type: 'done' };
    }

    async listModels(): Promise<ModelInfo[]> {
        // Anthropic doesn't have a models endpoint, return known models
        return [
            {
                id: 'claude-sonnet-4-20250514',
                name: 'Claude Sonnet 4',
                providerId: this.id,
                contextWindow: 200000,
                supportsTools: true,
                supportsVision: true,
                supportsStreaming: true,
            },
            {
                id: 'claude-3-5-haiku-20241022',
                name: 'Claude 3.5 Haiku',
                providerId: this.id,
                contextWindow: 200000,
                supportsTools: true,
                supportsVision: true,
                supportsStreaming: true,
            },
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet',
                providerId: this.id,
                contextWindow: 200000,
                supportsTools: true,
                supportsVision: true,
                supportsStreaming: true,
            },
        ];
    }

    async healthCheck(): Promise<HealthResult> {
        if (!this.apiKey) {
            return { ok: false, error: 'API key not configured' };
        }

        try {
            const start = Date.now();
            const response = await fetch(`${this.baseUrl}/v1/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: 'claude-3-5-haiku-20241022',
                    messages: [{ role: 'user', content: 'hi' }],
                    max_tokens: 1,
                }),
            });

            return {
                ok: response.ok,
                latencyMs: Date.now() - start,
                error: response.ok ? undefined : `HTTP ${response.status}`,
            };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Health check failed',
            };
        }
    }

    private buildRequestBody(messages: ChatMessage[], params: CompletionParams) {
        // Separate system from conversation messages
        const systemMessages = messages.filter((m) => m.role === 'system');
        const conversationMessages = messages.filter((m) => m.role !== 'system');

        return {
            model: 'claude-sonnet-4-20250514',
            system: systemMessages.map((m) => m.content).join('\n\n') || params.systemPrompt || undefined,
            messages: conversationMessages.map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            })),
            max_tokens: params.maxTokens ?? 1024,
            temperature: params.temperature,
            top_p: params.topP,
        };
    }
}
