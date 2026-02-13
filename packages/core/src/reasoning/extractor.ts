/**
 * Reasoning Extractor — Parse model-specific reasoning blocks
 * Phase 7 — Week 21
 *
 * Extracts thinking/reasoning blocks from model output and separates
 * them from the visible response content.
 */

import type { ReasoningBlock, ReasoningPattern } from '@chatbot/types';

// ─── Built-in Patterns ──────────────────────────────────────────

const BUILTIN_PATTERNS: ReasoningPattern[] = [
  {
    modelFamily: 'deepseek',
    openTag: '<think>',
    closeTag: '</think>',
    isRegex: false,
  },
  {
    modelFamily: 'qwen',
    openTag: '<think>',
    closeTag: '</think>',
    isRegex: false,
  },
  {
    modelFamily: 'claude',
    openTag: '<thinking>',
    closeTag: '</thinking>',
    isRegex: false,
  },
];

export interface ExtractionResult {
  /** The response text with reasoning blocks removed */
  content: string;
  /** Extracted reasoning blocks */
  reasoning: ReasoningBlock[];
}

/**
 * Extract reasoning blocks from model output text.
 */
export function extractReasoning(
  text: string,
  options?: {
    patterns?: ReasoningPattern[];
    modelFamily?: string;
  },
): ExtractionResult {
  const patterns = options?.patterns ?? BUILTIN_PATTERNS;
  const applicablePatterns = options?.modelFamily
    ? patterns.filter((p) => p.modelFamily === options.modelFamily || p.modelFamily === '*')
    : patterns;

  // If no patterns match, try all built-in patterns
  const patternsToTry = applicablePatterns.length > 0 ? applicablePatterns : BUILTIN_PATTERNS;

  const reasoning: ReasoningBlock[] = [];
  let content = text;

  for (const pattern of patternsToTry) {
    if (pattern.isRegex) {
      try {
        const regex = new RegExp(`${pattern.openTag}([\\s\\S]*?)${pattern.closeTag}`, 'g');
        const matches = content.matchAll(regex);
        for (const match of matches) {
          reasoning.push({
            type: 'parsed',
            content: match[1].trim(),
          });
        }
        content = content.replace(regex, '').trim();
      } catch {
        // Invalid regex, skip
      }
    } else {
      // Simple tag matching
      let startIdx = content.indexOf(pattern.openTag);
      while (startIdx !== -1) {
        const endIdx = content.indexOf(pattern.closeTag, startIdx + pattern.openTag.length);
        if (endIdx === -1) break;

        const reasoningContent = content.slice(
          startIdx + pattern.openTag.length,
          endIdx,
        ).trim();

        if (reasoningContent) {
          reasoning.push({
            type: 'parsed',
            content: reasoningContent,
          });
        }

        // Remove the block from content
        content = content.slice(0, startIdx) + content.slice(endIdx + pattern.closeTag.length);
        content = content.trim();

        // Look for next block
        startIdx = content.indexOf(pattern.openTag);
      }
    }

    if (reasoning.length > 0) {
      // Found reasoning with this pattern, stop trying others
      break;
    }
  }

  return { content, reasoning };
}

/**
 * Extract reasoning from a model API response that provides
 * reasoning as a separate field (e.g., Claude thinking, OpenAI o1/o3).
 */
export function extractModelReasoning(
  responseContent: string,
  modelReasoning?: string | null,
  durationMs?: number,
): ExtractionResult {
  const reasoning: ReasoningBlock[] = [];

  if (modelReasoning) {
    reasoning.push({
      type: 'model',
      content: modelReasoning,
      durationMs,
    });
  }

  // Also check for inline reasoning in the response text
  const inlineResult = extractReasoning(responseContent);
  reasoning.push(...inlineResult.reasoning);

  return {
    content: inlineResult.content,
    reasoning,
  };
}
