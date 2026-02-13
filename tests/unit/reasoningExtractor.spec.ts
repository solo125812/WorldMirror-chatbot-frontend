/**
 * Reasoning Extractor — Unit Tests
 * Phase 7 — Week 21
 */

import { describe, it, expect } from 'vitest';
import {
  extractReasoning,
  extractModelReasoning,
} from '../../packages/core/src/reasoning/extractor';
import type { ReasoningPattern } from '../../packages/types/src/reasoning';

describe('extractReasoning', () => {
  it('extracts DeepSeek/Qwen <think> blocks', () => {
    const text = '<think>Let me reason about this...</think>The answer is 42.';
    const result = extractReasoning(text);

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].type).toBe('parsed');
    expect(result.reasoning[0].content).toBe('Let me reason about this...');
    expect(result.content).toBe('The answer is 42.');
  });

  it('extracts Claude <thinking> blocks', () => {
    const text = '<thinking>I need to analyze this carefully.</thinking>Here is my response.';
    const result = extractReasoning(text);

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].type).toBe('parsed');
    expect(result.reasoning[0].content).toBe('I need to analyze this carefully.');
    expect(result.content).toBe('Here is my response.');
  });

  it('extracts multiple reasoning blocks', () => {
    const text =
      '<think>First thought</think>Some text<think>Second thought</think>More text.';
    const result = extractReasoning(text);

    expect(result.reasoning).toHaveLength(2);
    expect(result.reasoning[0].content).toBe('First thought');
    expect(result.reasoning[1].content).toBe('Second thought');
    // The extractor trims but doesn't add spaces between joined segments
    expect(result.content).toBe('Some textMore text.');
  });

  it('returns empty reasoning array when no blocks found', () => {
    const text = 'This is a plain response with no reasoning blocks.';
    const result = extractReasoning(text);

    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe(text);
  });

  it('handles empty string input', () => {
    const result = extractReasoning('');

    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe('');
  });

  it('skips empty reasoning blocks', () => {
    const text = '<think></think>Actual response.';
    const result = extractReasoning(text);

    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe('Actual response.');
  });

  it('handles unclosed tags gracefully', () => {
    const text = '<think>This reasoning never ends... and some response.';
    const result = extractReasoning(text);

    // Unclosed tag should not extract anything
    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe(text);
  });

  it('filters patterns by modelFamily when specified', () => {
    const text = '<thinking>Claude thinking</thinking>Response.';
    // deepseek patterns use <think>, not <thinking>
    const result = extractReasoning(text, { modelFamily: 'deepseek' });

    // deepseek pattern (<think>) doesn't match <thinking>, and the fallback
    // only triggers when applicablePatterns is empty (which it isn't — deepseek matched)
    // So nothing is extracted since <think> != <thinking>
    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe(text);
  });

  it('uses specific modelFamily pattern first', () => {
    const text = '<think>Some reasoning</think>Response.';
    const result = extractReasoning(text, { modelFamily: 'deepseek' });

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].content).toBe('Some reasoning');
    expect(result.content).toBe('Response.');
  });

  it('supports custom patterns', () => {
    const customPatterns: ReasoningPattern[] = [
      {
        modelFamily: '*',
        openTag: '[[REASON]]',
        closeTag: '[[/REASON]]',
        isRegex: false,
      },
    ];
    const text = '[[REASON]]Custom reasoning here[[/REASON]]Final answer.';
    const result = extractReasoning(text, { patterns: customPatterns });

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].content).toBe('Custom reasoning here');
    expect(result.content).toBe('Final answer.');
  });

  it('supports regex patterns', () => {
    const regexPatterns: ReasoningPattern[] = [
      {
        modelFamily: '*',
        openTag: '---THINK---',
        closeTag: '---/THINK---',
        isRegex: true,
      },
    ];
    const text = '---THINK---My thought process---/THINK---Here is the answer.';
    const result = extractReasoning(text, { patterns: regexPatterns });

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].content).toBe('My thought process');
    expect(result.content).toBe('Here is the answer.');
  });

  it('handles multiline reasoning content', () => {
    const text = `<think>
Step 1: Analyze the problem
Step 2: Consider alternatives
Step 3: Pick the best one
</think>
Based on my analysis, option B is best.`;
    const result = extractReasoning(text);

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].content).toContain('Step 1: Analyze the problem');
    expect(result.reasoning[0].content).toContain('Step 3: Pick the best one');
    expect(result.content).toBe('Based on my analysis, option B is best.');
  });

  it('trims whitespace from extracted content', () => {
    const text = '<think>  \n  padded reasoning  \n  </think>  Response text  ';
    const result = extractReasoning(text);

    expect(result.reasoning[0].content).toBe('padded reasoning');
    expect(result.content).toBe('Response text');
  });

  it('handles invalid regex patterns gracefully', () => {
    const invalidPatterns: ReasoningPattern[] = [
      {
        modelFamily: '*',
        openTag: '([invalid',
        closeTag: 'regex)',
        isRegex: true,
      },
    ];
    const text = 'Some text with no matching patterns.';
    const result = extractReasoning(text, { patterns: invalidPatterns });

    // Should not throw, just return content unchanged
    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe(text);
  });
});

describe('extractModelReasoning', () => {
  it('creates model-type reasoning block from API reasoning field', () => {
    const result = extractModelReasoning(
      'The answer is 42.',
      'I computed this by multiplying 6 by 7.',
    );

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].type).toBe('model');
    expect(result.reasoning[0].content).toBe('I computed this by multiplying 6 by 7.');
    expect(result.content).toBe('The answer is 42.');
  });

  it('includes durationMs when provided', () => {
    const result = extractModelReasoning(
      'Response.',
      'Thinking...',
      1500,
    );

    expect(result.reasoning[0].durationMs).toBe(1500);
  });

  it('combines model reasoning with inline parsed reasoning', () => {
    const responseText = '<think>Inline thought</think>Final answer.';
    const result = extractModelReasoning(responseText, 'API-level reasoning');

    expect(result.reasoning).toHaveLength(2);
    expect(result.reasoning[0].type).toBe('model');
    expect(result.reasoning[0].content).toBe('API-level reasoning');
    expect(result.reasoning[1].type).toBe('parsed');
    expect(result.reasoning[1].content).toBe('Inline thought');
    expect(result.content).toBe('Final answer.');
  });

  it('handles null model reasoning', () => {
    const result = extractModelReasoning('Plain response.', null);

    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe('Plain response.');
  });

  it('handles undefined model reasoning', () => {
    const result = extractModelReasoning('Plain response.');

    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe('Plain response.');
  });

  it('handles empty string model reasoning', () => {
    const result = extractModelReasoning('Response.', '');

    // Empty string is falsy, should not create a block
    expect(result.reasoning).toHaveLength(0);
    expect(result.content).toBe('Response.');
  });

  it('parses inline reasoning even without model reasoning', () => {
    const text = '<thinking>Some deep thoughts</thinking>My answer.';
    const result = extractModelReasoning(text);

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].type).toBe('parsed');
    expect(result.reasoning[0].content).toBe('Some deep thoughts');
    expect(result.content).toBe('My answer.');
  });
});
