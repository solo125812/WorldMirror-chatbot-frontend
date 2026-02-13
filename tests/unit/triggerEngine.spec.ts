/**
 * Unit tests for Trigger Engine
 */

import { describe, it, expect } from 'vitest';
import { executeTriggers, createTriggerContext } from '@chatbot/core';
import type { TriggerEngineConfig } from '@chatbot/core';
import type { Trigger, TriggerExecutionContext } from '@chatbot/types';

function makeTrigger(overrides: Partial<Trigger> = {}): Trigger {
  return {
    id: 'trg-1',
    name: 'Test Trigger',
    enabled: true,
    scope: 'global',
    characterId: null,
    activation: 'before_generation',
    conditions: [],
    effects: [],
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeConfig(variables: Map<string, string> = new Map()): TriggerEngineConfig {
  return {
    getVariable: (scope, key) => variables.get(`${scope}:${key}`) ?? null,
    setVariable: (scope, key, value) => variables.set(`${scope}:${key}`, value),
    maxTriggerDepth: 5,
  };
}

describe('createTriggerContext', () => {
  it('should create a fresh context with default values', () => {
    const ctx = createTriggerContext({
      messageContent: 'Hello world',
      chatId: 'chat-1',
      characterId: 'char-1',
      messageCount: 5,
    });

    expect(ctx.messageContent).toBe('Hello world');
    expect(ctx.chatId).toBe('chat-1');
    expect(ctx.characterId).toBe('char-1');
    expect(ctx.messageCount).toBe(5);
    expect(ctx.injections).toEqual([]);
    expect(ctx.alerts).toEqual([]);
    expect(ctx.stopGeneration).toBe(false);
  });
});

describe('executeTriggers', () => {
  it('should execute effects when no conditions', () => {
    const variables = new Map<string, string>();
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      effects: [
        { type: 'set_variable', scope: 'global', key: 'test_var', value: '42' },
      ],
    });

    const ctx = createTriggerContext({
      messageContent: 'test',
      messageCount: 1,
    });

    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(variables.get('global:test_var')).toBe('42');
  });

  it('should skip triggers with non-matching activation', () => {
    const variables = new Map<string, string>();
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      activation: 'after_generation',
      effects: [
        { type: 'set_variable', scope: 'global', key: 'test_var', value: '42' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(variables.has('global:test_var')).toBe(false);
  });

  it('should skip disabled triggers', () => {
    const variables = new Map<string, string>();
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      enabled: false,
      effects: [
        { type: 'set_variable', scope: 'global', key: 'test_var', value: '42' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(variables.has('global:test_var')).toBe(false);
  });

  it('should evaluate variable conditions', () => {
    const variables = new Map<string, string>();
    variables.set('global:counter', '5');
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      conditions: [
        { type: 'variable', field: 'counter', operator: '>=', value: '5' },
      ],
      effects: [
        { type: 'set_variable', scope: 'global', key: 'triggered', value: 'yes' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(variables.get('global:triggered')).toBe('yes');
  });

  it('should not execute when conditions are not met', () => {
    const variables = new Map<string, string>();
    variables.set('global:counter', '3');
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      conditions: [
        { type: 'variable', field: 'counter', operator: '>=', value: '5' },
      ],
      effects: [
        { type: 'set_variable', scope: 'global', key: 'triggered', value: 'yes' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(variables.has('global:triggered')).toBe(false);
  });

  it('should support inject_prompt effect', () => {
    const config = makeConfig();

    const trigger = makeTrigger({
      effects: [
        { type: 'inject_prompt', content: 'Injected text', position: 'before_history' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(ctx.injections).toHaveLength(1);
    expect(ctx.injections[0].content).toBe('Injected text');
    expect(ctx.injections[0].position).toBe('before_history');
  });

  it('should support stop_generation effect', () => {
    const config = makeConfig();

    const trigger = makeTrigger({
      effects: [
        { type: 'stop_generation' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(ctx.stopGeneration).toBe(true);
  });

  it('should support modify_message effect', () => {
    const config = makeConfig();

    const trigger = makeTrigger({
      effects: [
        { type: 'modify_message', find: 'test', replace: 'modified' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'this is a test message', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(ctx.messageContent).toBe('this is a modified message');
  });

  it('should support text_match condition', () => {
    const variables = new Map<string, string>();
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      conditions: [
        { type: 'text_match', field: 'content', operator: 'contains', value: 'secret' },
      ],
      effects: [
        { type: 'set_variable', scope: 'global', key: 'found_secret', value: 'true' },
      ],
    });

    // Message without 'secret'
    const ctx1 = createTriggerContext({ messageContent: 'normal message', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx1, config);
    expect(variables.has('global:found_secret')).toBe(false);

    // Message with 'secret'
    const ctx2 = createTriggerContext({ messageContent: 'this is a secret message', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx2, config);
    expect(variables.get('global:found_secret')).toBe('true');
  });

  it('should support message_count condition', () => {
    const variables = new Map<string, string>();
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      conditions: [
        { type: 'message_count', field: 'count', operator: '>', value: '10' },
      ],
      effects: [
        { type: 'set_variable', scope: 'global', key: 'many_messages', value: 'true' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 15 });
    executeTriggers([trigger], 'before_generation', ctx, config);
    expect(variables.get('global:many_messages')).toBe('true');
  });

  it('should support variable increment with += operator', () => {
    const variables = new Map<string, string>();
    variables.set('global:counter', '10');
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      effects: [
        { type: 'set_variable', scope: 'global', key: 'counter', value: '5', operator: '+=' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(variables.get('global:counter')).toBe('15');
  });

  it('should prevent infinite loops in run_trigger chains', () => {
    const variables = new Map<string, string>();
    const trigger1 = makeTrigger({
      id: 'trg-1',
      effects: [
        { type: 'set_variable', scope: 'global', key: 'marker', value: 'triggered' },
      ],
    });

    // Even if we have a run_trigger pointing to itself, it should not loop
    const config: TriggerEngineConfig = {
      getVariable: (scope, key) => variables.get(`${scope}:${key}`) ?? null,
      setVariable: (scope, key, value) => variables.set(`${scope}:${key}`, value),
      getTrigger: (id) => (id === 'trg-1' ? trigger1 : null),
      maxTriggerDepth: 3,
    };

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    // Should not throw
    executeTriggers([trigger1], 'before_generation', ctx, config);
    expect(variables.get('global:marker')).toBe('triggered');
  });

  it('should stop processing effects after stop_generation', () => {
    const variables = new Map<string, string>();
    const config = makeConfig(variables);

    const trigger = makeTrigger({
      effects: [
        { type: 'stop_generation' },
        { type: 'set_variable', scope: 'global', key: 'after_stop', value: 'yes' },
      ],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(ctx.stopGeneration).toBe(true);
    // The variable should NOT be set because processing stopped
    expect(variables.has('global:after_stop')).toBe(false);
  });

  it('should support run_regex effect with db-backed rule', () => {
    const variables = new Map<string, string>();
    const config: TriggerEngineConfig = {
      getVariable: (scope, key) => variables.get(`${scope}:${key}`) ?? null,
      setVariable: (scope, key, value) => variables.set(`${scope}:${key}`, value),
      getRegexRule: (id) => {
        if (id !== 'rule-1') return null;
        return {
          id: 'rule-1',
          name: 'Replace foo',
          enabled: true,
          scope: 'global',
          characterId: null,
          findRegex: 'foo',
          replaceString: 'bar',
          placement: ['user_input'],
          flags: 'g',
          order: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };
      },
      maxTriggerDepth: 5,
    };

    const trigger = makeTrigger({
      effects: [{ type: 'run_regex', ruleId: 'rule-1' }],
    });

    const ctx = createTriggerContext({ messageContent: 'foo fighters', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(ctx.messageContent).toBe('bar fighters');
  });

  it('should support show_alert effect', () => {
    const config = makeConfig();
    const trigger = makeTrigger({
      effects: [{ type: 'show_alert', message: 'Heads up', style: 'warning' }],
    });

    const ctx = createTriggerContext({ messageContent: 'test', messageCount: 1 });
    executeTriggers([trigger], 'before_generation', ctx, config);

    expect(ctx.alerts).toHaveLength(1);
    expect(ctx.alerts[0].message).toBe('Heads up');
    expect(ctx.alerts[0].style).toBe('warning');
  });
});
