/**
 * Group Chat Turn Selection — determines which character speaks next
 */

import type { GroupChat, NextSpeakerResult, ChatMessage } from '@chatbot/types';

/**
 * Select the next speaker based on the group's activation strategy.
 */
export function selectNextSpeaker(
  group: GroupChat,
  messages: ChatMessage[],
  lastSpeakerId?: string | null,
): NextSpeakerResult {
  switch (group.activationStrategy) {
    case 'sequential':
      return selectSequential(group, lastSpeakerId);
    case 'random':
      return selectRandom(group, lastSpeakerId);
    case 'smart':
      return selectSmart(group, messages, lastSpeakerId);
    default:
      return selectSequential(group, lastSpeakerId);
  }
}

function selectSequential(
  group: GroupChat,
  lastSpeakerId?: string | null,
): NextSpeakerResult {
  const order = group.replyOrder.length > 0 ? group.replyOrder : group.characterIds;
  if (order.length === 0) {
    throw new Error('Group has no characters');
  }

  if (!lastSpeakerId) {
    return { characterId: order[0], reason: 'First speaker in sequence' };
  }

  const currentIndex = order.indexOf(lastSpeakerId);
  const nextIndex = (currentIndex + 1) % order.length;

  // Skip self if not allowed
  if (!group.allowSelfResponses && order[nextIndex] === lastSpeakerId && order.length > 1) {
    const skipIndex = (nextIndex + 1) % order.length;
    return { characterId: order[skipIndex], reason: 'Sequential (skipped self)' };
  }

  return { characterId: order[nextIndex], reason: 'Sequential order' };
}

function selectRandom(
  group: GroupChat,
  lastSpeakerId?: string | null,
): NextSpeakerResult {
  let candidates = [...group.characterIds];

  if (!group.allowSelfResponses && lastSpeakerId && candidates.length > 1) {
    candidates = candidates.filter((id) => id !== lastSpeakerId);
  }

  if (candidates.length === 0) {
    throw new Error('No eligible characters for random selection');
  }

  const idx = Math.floor(Math.random() * candidates.length);
  return { characterId: candidates[idx], reason: 'Random selection' };
}

/**
 * Smart selection: uses heuristics based on recent message content.
 * In a full implementation, this would call an LLM to decide.
 * For now, uses mention detection + round-robin fallback.
 */
function selectSmart(
  group: GroupChat,
  messages: ChatMessage[],
  lastSpeakerId?: string | null,
): NextSpeakerResult {
  // Check if the user mentioned a specific character by name
  // We'd need character names here — for now use character IDs as fallback
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  if (lastUserMessage) {
    const content = lastUserMessage.content.toLowerCase();

    // Simple heuristic: check if any character ID appears in the message
    // In production, this would use character names resolved from the DB
    for (const charId of group.characterIds) {
      if (content.includes(charId.toLowerCase())) {
        return { characterId: charId, reason: `Mentioned in user message` };
      }
    }
  }

  // Fallback: least recently spoken character
  const speakerHistory = new Map<string, number>();
  for (const charId of group.characterIds) {
    speakerHistory.set(charId, 0);
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.metadata) {
      try {
        const meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
        if (meta.characterId && speakerHistory.has(meta.characterId)) {
          speakerHistory.set(meta.characterId, messages.length - i);
        }
      } catch {
        // Skip invalid metadata
      }
    }
  }

  // Pick the character who hasn't spoken in the longest time
  let bestId = group.characterIds[0];
  let bestAge = -1;

  for (const [charId, age] of speakerHistory) {
    if (!group.allowSelfResponses && charId === lastSpeakerId && group.characterIds.length > 1) {
      continue;
    }
    if (age > bestAge) {
      bestAge = age;
      bestId = charId;
    }
  }

  return { characterId: bestId, reason: 'Smart: least recently spoken' };
}

/**
 * Smart selection with LLM (placeholder for future implementation).
 * Would send recent messages + character descriptions to a small LLM
 * and ask "which character should respond next?"
 */
export function selectSmartWithLLM(
  _group: GroupChat,
  _messages: ChatMessage[],
  _characterDescriptions: Map<string, string>,
): Promise<NextSpeakerResult> {
  // TODO: Implement LLM-based speaker selection
  throw new Error('LLM-based speaker selection not yet implemented');
}
