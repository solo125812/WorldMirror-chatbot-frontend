/**
 * Unit tests for Instruct Formatter
 * Phase 7 — Week 20
 */

import { describe, it, expect } from 'vitest';
import {
  formatChatToInstruct,
  parseInstructToChat,
  detectFormat,
} from '@chatbot/core';
import { PromptFormatRegistry } from '@chatbot/core';

describe('PromptFormatRegistry', () => {
  it('lists 8 built-in presets', () => {
    const registry = new PromptFormatRegistry();
    const presets = registry.listPresets();
    expect(presets.length).toBe(8);
    const names = presets.map((p) => p.id);
    expect(names).toContain('chatml');
    expect(names).toContain('llama3');
    expect(names).toContain('alpaca');
    expect(names).toContain('vicuna');
    expect(names).toContain('mistral');
    expect(names).toContain('phi');
    expect(names).toContain('gemma');
    expect(names).toContain('command-r');
  });

  it('lists 8 built-in templates', () => {
    const registry = new PromptFormatRegistry();
    expect(registry.listTemplates().length).toBe(8);
  });

  it('gets a preset by ID', () => {
    const registry = new PromptFormatRegistry();
    const preset = registry.getPreset('chatml');
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('ChatML');
    expect(preset!.template.systemPrefix).toBe('<|im_start|>system\n');
  });

  it('returns undefined for unknown preset', () => {
    const registry = new PromptFormatRegistry();
    expect(registry.getPreset('nonexistent')).toBeUndefined();
  });

  it('detects ChatML preset for qwen model', () => {
    const registry = new PromptFormatRegistry();
    const preset = registry.detectPreset('Qwen2.5-72B-Instruct');
    expect(preset).toBeDefined();
    expect(preset!.id).toBe('chatml');
  });

  it('detects Llama 3 preset for llama-3 model', () => {
    const registry = new PromptFormatRegistry();
    const preset = registry.detectPreset('llama-3.1-70b-instruct');
    expect(preset).toBeDefined();
    expect(preset!.id).toBe('llama3');
  });

  it('detects Mistral preset for mixtral model', () => {
    const registry = new PromptFormatRegistry();
    const preset = registry.detectPreset('mixtral-8x7b-instruct');
    expect(preset).toBeDefined();
    expect(preset!.id).toBe('mistral');
  });

  it('detects Gemma preset for gemma model', () => {
    const registry = new PromptFormatRegistry();
    const preset = registry.detectPreset('gemma-2-9b');
    expect(preset).toBeDefined();
    expect(preset!.id).toBe('gemma');
  });

  it('returns undefined for chat-completion models (gpt-4)', () => {
    const registry = new PromptFormatRegistry();
    const preset = registry.detectPreset('gpt-4o-2024-05-13');
    expect(preset).toBeUndefined();
  });

  it('registers custom templates', () => {
    const registry = new PromptFormatRegistry();
    registry.registerTemplate({
      id: 'custom',
      name: 'Custom',
      systemPrefix: '<SYS>',
      systemSuffix: '</SYS>',
      userPrefix: '<USR>',
      userSuffix: '</USR>',
      assistantPrefix: '<AST>',
      assistantSuffix: '</AST>',
      stopSequences: ['</AST>'],
      wrapSequence: false,
      source: 'user',
    });
    expect(registry.getTemplate('custom')).toBeDefined();
    expect(registry.listTemplates().length).toBe(9);
  });

  it('adds model mappings with priority', () => {
    const registry = new PromptFormatRegistry();
    registry.addModelMapping({ pattern: 'my-custom-model', presetId: 'alpaca' });
    const preset = registry.detectPreset('my-custom-model-v2');
    expect(preset).toBeDefined();
    expect(preset!.id).toBe('alpaca');
  });
});

describe('formatChatToInstruct', () => {
  const registry = new PromptFormatRegistry();

  it('formats messages with ChatML template', () => {
    const template = registry.getTemplate('chatml')!;
    const messages = [
      { role: 'system' as const, content: 'You are helpful.' },
      { role: 'user' as const, content: 'Hello!' },
    ];

    const result = formatChatToInstruct(messages, template);
    expect(result).toContain('<|im_start|>system\nYou are helpful.<|im_end|>');
    expect(result).toContain('<|im_start|>user\nHello!<|im_end|>');
    expect(result).toContain('<|im_start|>assistant\n');
  });

  it('formats messages with Alpaca template', () => {
    const template = registry.getTemplate('alpaca')!;
    const messages = [
      { role: 'user' as const, content: 'What is 2+2?' },
    ];

    const result = formatChatToInstruct(messages, template);
    expect(result).toContain('### Instruction:\nWhat is 2+2?');
    expect(result).toContain('### Response:\n');
  });

  it('formats messages with Llama 3 template', () => {
    const template = registry.getTemplate('llama3')!;
    const messages = [
      { role: 'system' as const, content: 'Be concise.' },
      { role: 'user' as const, content: 'Hi' },
      { role: 'assistant' as const, content: 'Hello!' },
      { role: 'user' as const, content: 'How are you?' },
    ];

    const result = formatChatToInstruct(messages, template);
    expect(result).toContain('<|start_header_id|>system<|end_header_id|>');
    expect(result).toContain('Be concise.');
    expect(result).toContain('<|eot_id|>');
    expect(result).toContain('<|start_header_id|>user<|end_header_id|>');
    expect(result).toContain('<|start_header_id|>assistant<|end_header_id|>');
  });

  it('appends generation prompt by default', () => {
    const template = registry.getTemplate('chatml')!;
    const messages = [{ role: 'user' as const, content: 'Hi' }];
    const result = formatChatToInstruct(messages, template);
    expect(result.endsWith('<|im_start|>assistant\n')).toBe(true);
  });

  it('does not append generation prompt when disabled', () => {
    const template = registry.getTemplate('chatml')!;
    const messages = [{ role: 'user' as const, content: 'Hi' }];
    const result = formatChatToInstruct(messages, template, { appendGenerationPrompt: false });
    expect(result.endsWith('<|im_start|>assistant\n')).toBe(false);
  });

  it('overrides system prompt', () => {
    const template = registry.getTemplate('chatml')!;
    const messages = [
      { role: 'system' as const, content: 'Original system prompt' },
      { role: 'user' as const, content: 'Hi' },
    ];
    const result = formatChatToInstruct(messages, template, {
      systemPrompt: 'Custom system prompt',
    });
    expect(result).toContain('Custom system prompt');
    expect(result).not.toContain('Original system prompt');
  });

  it('handles tool messages as system context', () => {
    const template = registry.getTemplate('chatml')!;
    const messages = [
      { role: 'user' as const, content: 'Search for cats' },
      { role: 'tool' as const, content: '{"results": ["cat1", "cat2"]}' },
    ];
    const result = formatChatToInstruct(messages, template);
    expect(result).toContain('[Tool Result]');
    expect(result).toContain('{"results": ["cat1", "cat2"]}');
  });
});

describe('parseInstructToChat', () => {
  const registry = new PromptFormatRegistry();

  it('parses ChatML formatted text back to messages', () => {
    const template = registry.getTemplate('chatml')!;
    const text =
      '<|im_start|>system\nYou are helpful.<|im_end|>\n' +
      '<|im_start|>user\nHello!<|im_end|>\n' +
      '<|im_start|>assistant\nHi there!<|im_end|>\n';

    const messages = parseInstructToChat(text, template);
    expect(messages.length).toBe(3);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('You are helpful.');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('Hello!');
    expect(messages[2].role).toBe('assistant');
    expect(messages[2].content).toBe('Hi there!');
  });
});

describe('detectFormat', () => {
  it('detects ChatML format', () => {
    expect(detectFormat('<|im_start|>user\nHello<|im_end|>')).toBe('chatml');
  });

  it('detects Llama 3 format', () => {
    expect(detectFormat('<|start_header_id|>user<|end_header_id|>\nHello')).toBe('llama3');
  });

  it('detects Alpaca format', () => {
    expect(detectFormat('### Instruction:\nHello\n\n### Response:\n')).toBe('alpaca');
  });

  it('detects Vicuna format', () => {
    expect(detectFormat('USER: Hello\nASSISTANT: Hi\n')).toBe('vicuna');
  });

  it('detects Mistral format', () => {
    expect(detectFormat('[INST] Hello [/INST]\nHi</s>')).toBe('mistral');
  });

  it('detects Gemma format', () => {
    expect(detectFormat('<start_of_turn>user\nHello<end_of_turn>')).toBe('gemma');
  });

  it('returns null for unrecognized format', () => {
    expect(detectFormat('Just plain text without any markers')).toBeNull();
  });
});
