/**
 * Lorebook Activation Engine
 * Scans messages and character fields for keyword matches,
 * applies activation rules (case, whole-word, regex, groups, timed effects),
 * and returns content sections by prompt position.
 */

import type {
  LorebookEntry,
  Lorebook,
  LorebookActivationContext,
  LorebookPromptResult,
  LorebookPosition,
  LorebookDebugEntry,
} from '@chatbot/types';
import { estimateTokens } from '../orchestrator/tokenBudget.js';

/** A lorebook with its entries pre-loaded */
export interface LoadedLorebook {
  lorebook: Lorebook;
  entries: LorebookEntry[];
}

/**
 * Run the lorebook activation engine.
 * Returns sections of text grouped by prompt position.
 */
export function activateLorebooks(
  lorebooks: LoadedLorebook[],
  context: LorebookActivationContext,
): LorebookPromptResult {
  const result: LorebookPromptResult = {
    sections: {
      before_system: [],
      after_system: [],
      before_persona: [],
      after_persona: [],
      before_author: [],
      after_author: [],
      before_history: [],
      after_history: [],
    },
    totalTokens: 0,
    activatedCount: 0,
    debugLog: [],
    budgetExceeded: false,
  };

  // Build scan text from messages and character fields
  const scanTexts = buildScanTexts(context);

  // Track which group IDs have been activated (inclusion groups)
  const activatedGroups = new Set<string>();

  // Track recursion: entries whose content triggered other entries
  let recursionDepth = 0;

  // Collect all entries with their lorebook metadata
  const allEntries: Array<{ entry: LorebookEntry; lorebook: Lorebook }> = [];
  for (const { lorebook, entries } of lorebooks) {
    for (const entry of entries) {
      if (!entry.enabled) continue;
      allEntries.push({ entry, lorebook });
    }
  }

  // Sort by insertion order
  allEntries.sort((a, b) => a.entry.insertionOrder - b.entry.insertionOrder);

  // Collect initially matched entries
  const activated = new Set<string>();
  const toProcess = [...allEntries];

  // Process entries (with recursion support)
  const maxRecursion = Math.max(...lorebooks.map((l) => l.lorebook.maxRecursionSteps), 0) || 3;

  const processRound = (texts: string[], depth: number): void => {
    if (depth > maxRecursion) return;

    const newlyActivated: Array<{ entry: LorebookEntry; lorebook: Lorebook; matchedKey: string }> = [];

    for (const { entry, lorebook } of toProcess) {
      if (activated.has(entry.id)) continue;

      // Timed effects check
      if (!checkTimedEffects(entry, context)) continue;

      // Constant entries always activate
      if (entry.constant) {
        activated.add(entry.id);
        newlyActivated.push({ entry, lorebook, matchedKey: '(constant)' });
        continue;
      }

      // Inclusion group check — only one per group
      if (entry.groupId && activatedGroups.has(entry.groupId)) continue;

      // Match keys
      const useCaseSensitive = entry.caseSensitive || lorebook.caseSensitive;
      const useWholeWords = entry.matchWholeWords || lorebook.matchWholeWords;

      const matched = matchKeys(
        entry.keys,
        texts,
        entry.regex,
        useCaseSensitive,
        useWholeWords,
      );

      if (!matched.found) continue;

      // Selective mode: require secondary keys
      if (entry.selective && entry.secondaryKeys.length > 0) {
        const secondaryMatched = matchKeys(
          entry.secondaryKeys,
          texts,
          entry.regex,
          useCaseSensitive,
          useWholeWords,
        );
        if (!secondaryMatched.found) continue;
      }

      activated.add(entry.id);
      if (entry.groupId) activatedGroups.add(entry.groupId);
      newlyActivated.push({ entry, lorebook, matchedKey: matched.key });
    }

    // Add activated entries to result
    for (const { entry, lorebook, matchedKey } of newlyActivated) {
      const tokens = estimateTokens(entry.content);

      // Budget check per lorebook
      const currentBudget = result.totalTokens + tokens;
      if (currentBudget > lorebook.budgetTokens) {
        result.budgetExceeded = true;
        result.debugLog.push({
          entryId: entry.id,
          lorebookName: lorebook.name,
          keys: entry.keys,
          matchedKey,
          position: entry.position,
          reason: `Budget exceeded (${currentBudget} > ${lorebook.budgetTokens})`,
        });
        continue;
      }

      result.sections[entry.position].push(entry.content);
      result.totalTokens += tokens;
      result.activatedCount++;

      result.debugLog.push({
        entryId: entry.id,
        lorebookName: lorebook.name,
        keys: entry.keys,
        matchedKey,
        position: entry.position,
        reason: entry.constant ? 'Constant entry' : `Matched key: "${matchedKey}"`,
      });
    }

    // Recursive scanning: scan activated content for more triggers
    if (newlyActivated.length > 0 && depth < maxRecursion) {
      const newTexts = newlyActivated
        .filter(({ entry }) => !entry.excludeRecursion)
        .map(({ entry }) => entry.content);

      if (newTexts.length > 0) {
        processRound(newTexts, depth + 1);
      }
    }
  };

  processRound(scanTexts, 0);

  return result;
}

/** Build the scan text array from context */
function buildScanTexts(context: LorebookActivationContext): string[] {
  const texts: string[] = [];

  // Recent messages (limited by scan depth — handled externally, all messages passed are scanned)
  for (const msg of context.messages) {
    texts.push(msg.content);
  }

  // Character fields
  if (context.characterFields) {
    const cf = context.characterFields;
    if (cf.description) texts.push(cf.description);
    if (cf.personality) texts.push(cf.personality);
    if (cf.scenario) texts.push(cf.scenario);
    if (cf.systemPrompt) texts.push(cf.systemPrompt);
  }

  // Author's note
  if (context.authorNote) {
    texts.push(context.authorNote);
  }

  return texts;
}

/** Match any of the given keys against any of the texts */
function matchKeys(
  keys: string[],
  texts: string[],
  useRegex: boolean,
  caseSensitive: boolean,
  wholeWord: boolean,
): { found: boolean; key: string } {
  const combinedText = texts.join('\n');

  for (const key of keys) {
    if (!key) continue;

    try {
      if (useRegex) {
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(key, flags);
        if (regex.test(combinedText)) {
          return { found: true, key };
        }
      } else if (wholeWord) {
        const escaped = escapeRegex(key);
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(`\\b${escaped}\\b`, flags);
        if (regex.test(combinedText)) {
          return { found: true, key };
        }
      } else {
        const haystack = caseSensitive ? combinedText : combinedText.toLowerCase();
        const needle = caseSensitive ? key : key.toLowerCase();
        if (haystack.includes(needle)) {
          return { found: true, key };
        }
      }
    } catch {
      // Invalid regex — skip this key
    }
  }

  return { found: false, key: '' };
}

/** Check timed effects (sticky, cooldown, delay) */
function checkTimedEffects(
  entry: LorebookEntry,
  context: LorebookActivationContext,
): boolean {
  if (!context.currentTurn || !context.activationHistory) return true;

  const history = context.activationHistory.get(entry.id);
  const currentTurn = context.currentTurn;

  // Delay: don't activate until N turns after first possible activation
  if (entry.delayTurns != null && entry.delayTurns > 0) {
    if (!history) return false; // Never activated, start tracking
    const turnsElapsed = currentTurn - history.lastActivatedTurn;
    if (turnsElapsed < entry.delayTurns) return false;
  }

  // Cooldown: can't activate again for N turns after last activation
  if (entry.cooldownTurns != null && entry.cooldownTurns > 0 && history) {
    const turnsElapsed = currentTurn - history.lastActivatedTurn;
    if (turnsElapsed < entry.cooldownTurns) return false;
  }

  // Sticky: stays active for N turns after activation
  if (entry.stickyTurns != null && entry.stickyTurns > 0 && history) {
    const turnsElapsed = currentTurn - history.lastActivatedTurn;
    if (turnsElapsed <= entry.stickyTurns) return true; // Force activate
  }

  return true;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format activated lorebook sections into a flat string per position.
 */
export function formatLorebookSection(sections: string[]): string {
  return sections.join('\n\n');
}
