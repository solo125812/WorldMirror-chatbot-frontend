/**
 * Token Budget Allocator
 * Approximate token counting and priority-based history trimming.
 * Phase 7: Now supports pluggable token counter via TokenizerRegistry.
 */

export interface TokenBudget {
    total: number;
    system: number;
    persona: number;
    memory: number;
    history: number;
    response: number;
}

export interface BudgetOptions {
    contextWindow: number;
    maxResponseTokens: number;
    systemTokens?: number;
    personaTokens?: number;
    memoryTokens?: number;
}

/**
 * Token counter function signature.
 * Phase 7: Allows plugging in a model-aware tokenizer from TokenizerRegistry.
 */
export type TokenCounter = (text: string) => number;

/**
 * Approximate token count using word-based heuristic.
 * ~1.3 tokens per word for English text (conservative estimate).
 * For more accurate counting, use TokenizerRegistry.countTokens() instead.
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    // Count words and multiply by 1.3, then add a small offset for special tokens
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.ceil(words * 1.3) + 2;
}

/**
 * Calculate token budgets for each prompt section.
 */
export function allocateBudget(opts: BudgetOptions): TokenBudget {
    const total = opts.contextWindow;
    const response = opts.maxResponseTokens;

    // Reserve fixed portions
    const system = opts.systemTokens ?? 200;
    const persona = opts.personaTokens ?? 300;
    const memory = opts.memoryTokens ?? 0; // Phase 3

    // Remaining goes to history
    const history = Math.max(0, total - response - system - persona - memory);

    return { total, system, persona, memory, history, response };
}

/**
 * Trim messages to fit within a token budget.
 * Strategy: keep system messages, keep the most recent messages, drop oldest first.
 *
 * @param messages — The messages to trim
 * @param maxTokens — Maximum token budget for kept messages
 * @param counter — Optional custom token counter (default: estimateTokens heuristic).
 *   Use `TokenizerRegistry.getTokenizer(modelId).count` for model-aware counting.
 */
export function trimHistory<T extends { role: string; content: string }>(
    messages: T[],
    maxTokens: number,
    counter?: TokenCounter,
): T[] {
    if (maxTokens <= 0) return [];

    const countFn = counter ?? estimateTokens;

    // Calculate total tokens
    let totalTokens = 0;
    const tokenCounts = messages.map((m) => {
        const count = countFn(m.content);
        totalTokens += count;
        return count;
    });

    // If we're within budget, return all messages
    if (totalTokens <= maxTokens) return messages;

    // Separate system messages (always keep) from conversation messages
    const result: T[] = [];
    const conversationMessages: Array<{ msg: T; tokens: number; index: number }> = [];
    let systemTokensUsed = 0;

    for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'system') {
            result.push(messages[i]);
            systemTokensUsed += tokenCounts[i];
        } else {
            conversationMessages.push({
                msg: messages[i],
                tokens: tokenCounts[i],
                index: i,
            });
        }
    }

    // Available budget for conversation messages
    let available = maxTokens - systemTokensUsed;

    // Keep messages from the end (most recent first)
    const kept: typeof conversationMessages = [];
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
        if (available >= conversationMessages[i].tokens) {
            available -= conversationMessages[i].tokens;
            kept.unshift(conversationMessages[i]);
        } else {
            break; // Stop at the first message that doesn't fit
        }
    }

    // Re-insert conversation messages in original order after system messages
    result.push(...kept.map((k) => k.msg));

    return result;
}
