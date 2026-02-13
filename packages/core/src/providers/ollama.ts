/**
 * Ollama Provider — Adapter for the Ollama local LLM API
 */

import type { ChatMessage, CompletionParams, ModelInfo, HealthResult, StreamChunk, LLMProvider } from '@chatbot/types';
import { logger } from '@chatbot/utils';

export class OllamaProvider implements LLMProvider {
    readonly id = 'ollama';
    readonly name = 'Ollama';
    readonly type = 'ollama';

    private baseUrl: string;

    constructor(opts?: { baseUrl?: string }) {
        this.baseUrl = opts?.baseUrl ?? 'http://localhost:11434';
    }

    async *createChatCompletion(
        messages: ChatMessage[],
        params: CompletionParams,
    ): AsyncIterable<StreamChunk> {
        const body = {
            model: params.modelId ?? 'llama3.2',
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            stream: true,
            options: {
                temperature: params.temperature,
                top_p: params.topP,
                num_predict: params.maxTokens,
                stop: params.stopSequences,
            },
        };

        if (params.systemPrompt) {
            body.messages.unshift({ role: 'system', content: params.systemPrompt });
        }

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } catch (error) {
            logger.error('Ollama connection failed', { error });
            yield { type: 'error', message: 'Ollama server not reachable' };
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Ollama API error', { status: response.status, error: errorText });
            yield { type: 'error', message: `Ollama API error: ${response.status}` };
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
                    if (!line.trim()) continue;

                    try {
                        const event = JSON.parse(line);

                        if (event.message?.content) {
                            yield { type: 'token', value: event.message.content };
                        }

                        if (event.done) {
                            yield { type: 'done' };
                            return;
                        }
                    } catch {
                        // Skip malformed NDJSON lines
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        yield { type: 'done' };
    }

    async listModels(): Promise<ModelInfo[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) {
                logger.error('Ollama list models failed', { status: response.status });
                return [];
            }

            const data = (await response.json()) as { models?: Array<{ name: string; details?: any }> };
            return (data.models ?? []).map((m) => ({
                id: m.name,
                name: m.name,
                providerId: this.id,
                contextWindow: m.details?.parameter_size ? this.estimateContext(m.details.parameter_size) : 4096,
                supportsTools: false,
                supportsVision: false,
                supportsStreaming: true,
            }));
        } catch (error) {
            logger.error('Ollama connection failed for model listing', { error });
            return [];
        }
    }

    async healthCheck(): Promise<HealthResult> {
        try {
            const start = Date.now();
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return {
                ok: response.ok,
                latencyMs: Date.now() - start,
                error: response.ok ? undefined : `HTTP ${response.status}`,
            };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Ollama server not reachable',
            };
        }
    }

    private estimateContext(paramSize: string): number {
        // Very rough context window estimation based on model size
        const size = paramSize.toLowerCase();
        if (size.includes('70b') || size.includes('65b')) return 8192;
        if (size.includes('13b') || size.includes('34b')) return 4096;
        return 4096;
    }
}
