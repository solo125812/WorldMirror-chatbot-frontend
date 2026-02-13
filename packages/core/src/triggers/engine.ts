/**
 * Trigger Engine — evaluates conditions and executes effects
 */

import type {
  Trigger,
  TriggerCondition,
  TriggerEffect,
  TriggerExecutionContext,
  TriggerActivation,
  DbRegexRule,
} from '@chatbot/types';

export interface TriggerEngineConfig {
  /** Get a variable value */
  getVariable: (scope: 'global' | 'chat', key: string, chatId?: string) => string | null;
  /** Set a variable value */
  setVariable: (scope: 'global' | 'chat', key: string, value: string, chatId?: string) => void;
  /** Get a regex rule by ID */
  getRegexRule?: (id: string) => DbRegexRule | null;
  /** Get a trigger by ID (for run_trigger effect) */
  getTrigger?: (id: string) => Trigger | null;
  /** Max recursion depth for run_trigger chains */
  maxTriggerDepth?: number;
}

/**
 * Execute triggers for a given activation point.
 * Returns the execution context with accumulated injections, alerts, and modifications.
 */
export function executeTriggers(
  triggers: Trigger[],
  activation: TriggerActivation,
  context: TriggerExecutionContext,
  config: TriggerEngineConfig,
): TriggerExecutionContext {
  const maxDepth = config.maxTriggerDepth ?? 5;
  const executed = new Set<string>();

  const runTrigger = (trigger: Trigger, depth: number): void => {
    if (depth > maxDepth) return;
    if (executed.has(trigger.id)) return; // Prevent infinite loops
    executed.add(trigger.id);

    if (!trigger.enabled) return;
    if (trigger.activation !== activation) return;

    // Evaluate conditions
    if (!evaluateConditions(trigger.conditions, context, config)) return;

    // Execute effects
    for (const effect of trigger.effects) {
      if (context.stopGeneration) break;
      executeEffect(effect, context, config, depth);
    }
  };

  for (const trigger of triggers) {
    if (context.stopGeneration) break;
    runTrigger(trigger, 0);
  }

  return context;
}

/** Create a fresh execution context */
export function createTriggerContext(opts: {
  messageContent: string;
  chatId?: string;
  characterId?: string;
  messageCount: number;
}): TriggerExecutionContext {
  return {
    messageContent: opts.messageContent,
    chatId: opts.chatId,
    characterId: opts.characterId,
    messageCount: opts.messageCount,
    injections: [],
    alerts: [],
    stopGeneration: false,
  };
}

function evaluateConditions(
  conditions: TriggerCondition[],
  context: TriggerExecutionContext,
  config: TriggerEngineConfig,
): boolean {
  if (conditions.length === 0) return true;

  let result = true;
  let logicOp: 'AND' | 'OR' = 'AND';

  for (const condition of conditions) {
    const condResult = evaluateCondition(condition, context, config);

    if (logicOp === 'AND') {
      result = result && condResult;
    } else {
      result = result || condResult;
    }

    logicOp = condition.logicOp ?? 'AND';
  }

  return result;
}

function evaluateCondition(
  condition: TriggerCondition,
  context: TriggerExecutionContext,
  config: TriggerEngineConfig,
): boolean {
  let fieldValue: string | number;

  switch (condition.type) {
    case 'variable': {
      const raw = config.getVariable('chat', condition.field, context.chatId)
        ?? config.getVariable('global', condition.field);
      fieldValue = raw ?? '';
      break;
    }
    case 'message_count':
      fieldValue = context.messageCount;
      break;
    case 'text_match':
      fieldValue = context.messageContent;
      break;
    case 'regex_match':
      fieldValue = context.messageContent;
      break;
    default:
      return false;
  }

  const targetValue = condition.value;

  switch (condition.operator) {
    case '==':
      return String(fieldValue) === String(targetValue);
    case '!=':
      return String(fieldValue) !== String(targetValue);
    case '>':
      return Number(fieldValue) > Number(targetValue);
    case '<':
      return Number(fieldValue) < Number(targetValue);
    case '>=':
      return Number(fieldValue) >= Number(targetValue);
    case '<=':
      return Number(fieldValue) <= Number(targetValue);
    case 'contains':
      return String(fieldValue).includes(String(targetValue));
    case 'matches':
      try {
        return new RegExp(String(targetValue), 'i').test(String(fieldValue));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function executeEffect(
  effect: TriggerEffect,
  context: TriggerExecutionContext,
  config: TriggerEngineConfig,
  depth: number,
): void {
  switch (effect.type) {
    case 'set_variable': {
      const currentRaw = config.getVariable(effect.scope, effect.key, context.chatId) ?? '0';

      let newValue: string;
      switch (effect.operator) {
        case '+=':
          newValue = String(Number(currentRaw) + Number(effect.value));
          break;
        case '-=':
          newValue = String(Number(currentRaw) - Number(effect.value));
          break;
        default:
          newValue = effect.value;
      }

      config.setVariable(effect.scope, effect.key, newValue, context.chatId);
      break;
    }

    case 'inject_prompt':
      context.injections.push({
        content: effect.content,
        position: effect.position,
      });
      break;

    case 'modify_message':
      // Modify the current message content
      try {
        const regex = new RegExp(effect.find, 'g');
        context.messageContent = context.messageContent.replace(regex, effect.replace);
      } catch {
        // Invalid regex — skip
      }
      break;

    case 'run_regex':
      if (config.getRegexRule) {
        const rule = config.getRegexRule(effect.ruleId);
        if (rule && rule.enabled) {
          try {
            const regex = new RegExp(rule.findRegex, rule.flags);
            context.messageContent = context.messageContent.replace(regex, rule.replaceString);
          } catch {
            // Invalid regex — skip
          }
        }
      }
      break;

    case 'show_alert':
      context.alerts.push({
        message: effect.message,
        style: effect.style,
      });
      break;

    case 'stop_generation':
      context.stopGeneration = true;
      break;

    case 'run_trigger':
      if (config.getTrigger && depth < (config.maxTriggerDepth ?? 5)) {
        const childTrigger = config.getTrigger(effect.triggerId);
        if (childTrigger) {
          executeTriggers([childTrigger], childTrigger.activation, context, config);
        }
      }
      break;
  }
}
