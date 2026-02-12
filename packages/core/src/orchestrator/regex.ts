/**
 * Regex Replacement Pipeline — applies text transformations at defined points
 *
 * Two insertion points:
 *   - user_input: applied to user messages before sending to LLM
 *   - ai_output: applied to assistant responses before displaying to user
 */

export interface RegexRule {
    id: string;
    name: string;
    pattern: string;
    replacement: string;
    scope: 'user_input' | 'ai_output';
    flags?: string;
    enabled: boolean;
}

/**
 * Apply all matching regex rules to a text string.
 * Only rules matching the specified scope and enabled=true are applied.
 */
export function applyRegexRules(text: string, rules: RegexRule[], scope: 'user_input' | 'ai_output'): string {
    if (!text || !rules.length) return text;

    let result = text;

    for (const rule of rules) {
        if (!rule.enabled || rule.scope !== scope) continue;

        try {
            const flags = rule.flags ?? 'g';
            const regex = new RegExp(rule.pattern, flags);
            result = result.replace(regex, rule.replacement);
        } catch {
            // Skip invalid regex patterns silently
        }
    }

    return result;
}

/**
 * Validate a regex rule — checks if the pattern compiles.
 */
export function validateRegexRule(rule: Pick<RegexRule, 'pattern' | 'flags'>): { valid: boolean; error?: string } {
    try {
        new RegExp(rule.pattern, rule.flags ?? 'g');
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Invalid regex pattern',
        };
    }
}
