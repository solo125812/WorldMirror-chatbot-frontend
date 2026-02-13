/**
 * Prompt Format Registry — Built-in instruct templates
 * Phase 7 — Week 20
 *
 * Provides 8 built-in instruct templates for text-completion backends.
 * Chat-completion APIs (OpenAI, Anthropic) handle formatting internally
 * and do not need instruct templates.
 */

import type { InstructTemplate, InstructPreset, InstructModelMapping } from '@chatbot/types';

// ─── Built-in Templates ──────────────────────────────────────────

const chatml: InstructTemplate = {
  id: 'chatml',
  name: 'ChatML',
  systemPrefix: '<|im_start|>system\n',
  systemSuffix: '<|im_end|>\n',
  userPrefix: '<|im_start|>user\n',
  userSuffix: '<|im_end|>\n',
  assistantPrefix: '<|im_start|>assistant\n',
  assistantSuffix: '<|im_end|>\n',
  stopSequences: ['<|im_end|>'],
  wrapSequence: false,
  source: 'builtin',
};

const llama3: InstructTemplate = {
  id: 'llama3',
  name: 'Llama 3',
  systemPrefix: '<|start_header_id|>system<|end_header_id|>\n\n',
  systemSuffix: '<|eot_id|>\n',
  userPrefix: '<|start_header_id|>user<|end_header_id|>\n\n',
  userSuffix: '<|eot_id|>\n',
  assistantPrefix: '<|start_header_id|>assistant<|end_header_id|>\n\n',
  assistantSuffix: '<|eot_id|>\n',
  stopSequences: ['<|eot_id|>'],
  wrapSequence: true,
  source: 'builtin',
};

const alpaca: InstructTemplate = {
  id: 'alpaca',
  name: 'Alpaca',
  systemPrefix: '',
  systemSuffix: '\n\n',
  userPrefix: '### Instruction:\n',
  userSuffix: '\n\n',
  assistantPrefix: '### Response:\n',
  assistantSuffix: '\n\n',
  stopSequences: ['### Instruction:', '### Response:'],
  wrapSequence: false,
  source: 'builtin',
};

const vicuna: InstructTemplate = {
  id: 'vicuna',
  name: 'Vicuna',
  systemPrefix: '',
  systemSuffix: '\n\n',
  userPrefix: 'USER: ',
  userSuffix: '\n',
  assistantPrefix: 'ASSISTANT: ',
  assistantSuffix: '\n',
  stopSequences: ['USER:', 'ASSISTANT:'],
  wrapSequence: false,
  source: 'builtin',
};

const mistral: InstructTemplate = {
  id: 'mistral',
  name: 'Mistral',
  systemPrefix: '[INST] ',
  systemSuffix: '\n',
  userPrefix: '[INST] ',
  userSuffix: ' [/INST]\n',
  assistantPrefix: '',
  assistantSuffix: '</s>\n',
  stopSequences: ['[INST]', '</s>'],
  wrapSequence: false,
  source: 'builtin',
};

const phi: InstructTemplate = {
  id: 'phi',
  name: 'Phi',
  systemPrefix: '<|system|>\n',
  systemSuffix: '<|end|>\n',
  userPrefix: '<|user|>\n',
  userSuffix: '<|end|>\n',
  assistantPrefix: '<|assistant|>\n',
  assistantSuffix: '<|end|>\n',
  stopSequences: ['<|end|>', '<|user|>'],
  wrapSequence: false,
  source: 'builtin',
};

const gemma: InstructTemplate = {
  id: 'gemma',
  name: 'Gemma',
  systemPrefix: '',
  systemSuffix: '\n',
  userPrefix: '<start_of_turn>user\n',
  userSuffix: '<end_of_turn>\n',
  assistantPrefix: '<start_of_turn>model\n',
  assistantSuffix: '<end_of_turn>\n',
  stopSequences: ['<end_of_turn>'],
  wrapSequence: false,
  source: 'builtin',
};

const commandR: InstructTemplate = {
  id: 'command-r',
  name: 'Command-R',
  systemPrefix: '<|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|>',
  systemSuffix: '<|END_OF_TURN_TOKEN|>\n',
  userPrefix: '<|START_OF_TURN_TOKEN|><|USER_TOKEN|>',
  userSuffix: '<|END_OF_TURN_TOKEN|>\n',
  assistantPrefix: '<|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|>',
  assistantSuffix: '<|END_OF_TURN_TOKEN|>\n',
  stopSequences: ['<|END_OF_TURN_TOKEN|>'],
  wrapSequence: false,
  source: 'builtin',
};

// ─── Template Map ────────────────────────────────────────────────

const BUILTIN_TEMPLATES: Map<string, InstructTemplate> = new Map([
  ['chatml', chatml],
  ['llama3', llama3],
  ['alpaca', alpaca],
  ['vicuna', vicuna],
  ['mistral', mistral],
  ['phi', phi],
  ['gemma', gemma],
  ['command-r', commandR],
]);

// ─── Built-in Presets ────────────────────────────────────────────

const BUILTIN_PRESETS: InstructPreset[] = [
  {
    id: 'chatml',
    name: 'ChatML',
    description: 'Used by Qwen, Hermes, and many fine-tunes',
    template: chatml,
    modelPatterns: ['qwen', 'hermes', 'nous-hermes', 'dolphin', 'openchat'],
  },
  {
    id: 'llama3',
    name: 'Llama 3',
    description: 'Used by Llama 3, Llama 3.1, and Llama 3.2 models',
    template: llama3,
    modelPatterns: ['llama-3', 'llama3', 'llama-3.1', 'llama-3.2'],
  },
  {
    id: 'alpaca',
    name: 'Alpaca',
    description: 'Used by Alpaca fine-tunes',
    template: alpaca,
    modelPatterns: ['alpaca'],
  },
  {
    id: 'vicuna',
    name: 'Vicuna',
    description: 'Used by Vicuna models',
    template: vicuna,
    modelPatterns: ['vicuna'],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    description: 'Used by Mistral and Mixtral models',
    template: mistral,
    modelPatterns: ['mistral', 'mixtral'],
  },
  {
    id: 'phi',
    name: 'Phi',
    description: 'Used by Phi-2, Phi-3, Phi-4 models',
    template: phi,
    modelPatterns: ['phi-2', 'phi-3', 'phi-4', 'phi'],
  },
  {
    id: 'gemma',
    name: 'Gemma',
    description: 'Used by Gemma and Gemma 2 models',
    template: gemma,
    modelPatterns: ['gemma'],
  },
  {
    id: 'command-r',
    name: 'Command-R',
    description: 'Used by Cohere Command-R models',
    template: commandR,
    modelPatterns: ['command-r', 'c4ai'],
  },
];

// ─── Default Model Mappings ──────────────────────────────────────

const DEFAULT_MODEL_MAPPINGS: InstructModelMapping[] = [
  { pattern: 'qwen|hermes|nous-hermes|dolphin|openchat', presetId: 'chatml' },
  { pattern: 'llama-3|llama3', presetId: 'llama3' },
  { pattern: 'alpaca', presetId: 'alpaca' },
  { pattern: 'vicuna', presetId: 'vicuna' },
  { pattern: 'mistral|mixtral', presetId: 'mistral' },
  { pattern: 'phi-[234]|phi', presetId: 'phi' },
  { pattern: 'gemma', presetId: 'gemma' },
  { pattern: 'command-r|c4ai', presetId: 'command-r' },
];

// ─── Registry ────────────────────────────────────────────────────

export class PromptFormatRegistry {
  private templates: Map<string, InstructTemplate>;
  private presets: Map<string, InstructPreset>;
  private modelMappings: InstructModelMapping[];

  constructor() {
    this.templates = new Map(BUILTIN_TEMPLATES);
    this.presets = new Map(BUILTIN_PRESETS.map((p) => [p.id, p]));
    this.modelMappings = [...DEFAULT_MODEL_MAPPINGS];
  }

  /**
   * Get a template by ID.
   */
  getTemplate(id: string): InstructTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all available templates.
   */
  listTemplates(): InstructTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Register a custom/user template.
   */
  registerTemplate(template: InstructTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get a preset by ID.
   */
  getPreset(id: string): InstructPreset | undefined {
    return this.presets.get(id);
  }

  /**
   * Get all available presets.
   */
  listPresets(): InstructPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Register a custom/user preset.
   */
  registerPreset(preset: InstructPreset): void {
    this.presets.set(preset.id, preset);
    // Also register the template if not already present
    if (!this.templates.has(preset.template.id)) {
      this.templates.set(preset.template.id, preset.template);
    }
  }

  /**
   * Auto-detect the best instruct preset for a given model ID.
   * Returns undefined if no match is found (i.e. model uses chat-completion API).
   */
  detectPreset(modelId: string): InstructPreset | undefined {
    const lowerModelId = modelId.toLowerCase();
    for (const mapping of this.modelMappings) {
      try {
        const regex = new RegExp(mapping.pattern, 'i');
        if (regex.test(lowerModelId)) {
          return this.presets.get(mapping.presetId);
        }
      } catch {
        // Invalid regex pattern, skip
        if (lowerModelId.includes(mapping.pattern.toLowerCase())) {
          return this.presets.get(mapping.presetId);
        }
      }
    }
    return undefined;
  }

  /**
   * Add a model mapping for auto-detection.
   */
  addModelMapping(mapping: InstructModelMapping): void {
    // Prepend to give user mappings priority over built-in ones
    this.modelMappings.unshift(mapping);
  }

  /**
   * Get the current model mappings.
   */
  getModelMappings(): InstructModelMapping[] {
    return [...this.modelMappings];
  }
}
