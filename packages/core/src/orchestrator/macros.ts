/**
 * Macro Expansion — replaces template variables in text fields
 *
 * Supported macros:
 *   {{user}}  - Current user's display name
 *   {{char}}  - Current character's name
 *   {{time}}  - Current time (HH:MM)
 *   {{date}}  - Current date (YYYY-MM-DD)
 *   {{model}} - Active model name/id
 */

export interface MacroContext {
    userName?: string;
    charName?: string;
    modelName?: string;
}

const MACRO_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Expand macros in a text string using the provided context.
 */
export function expandMacros(text: string, ctx: MacroContext): string {
    if (!text) return text;

    return text.replace(MACRO_PATTERN, (match, key: string) => {
        switch (key.toLowerCase()) {
            case 'user':
                return ctx.userName ?? 'User';
            case 'char':
                return ctx.charName ?? 'Assistant';
            case 'time': {
                const now = new Date();
                return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            case 'date': {
                const now = new Date();
                return now.toISOString().slice(0, 10);
            }
            case 'model':
                return ctx.modelName ?? 'unknown';
            default:
                return match; // Leave unrecognized macros as-is
        }
    });
}

/**
 * Expand macros in all string fields of an object (shallow).
 */
export function expandMacrosInObject<T extends Record<string, unknown>>(
    obj: T,
    ctx: MacroContext,
): T {
    const result = { ...obj };
    for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'string') {
            (result as any)[key] = expandMacros(value, ctx);
        }
    }
    return result;
}
