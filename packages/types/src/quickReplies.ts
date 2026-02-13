/**
 * Quick Reply type definitions
 * Phase 7 — Week 22
 */

/**
 * A set of quick reply buttons (global or per-character)
 */
export interface QuickReplySet {
  id: string;
  name: string;
  scope: 'global' | 'character';
  characterId?: string;
  items: QuickReplyItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A single quick reply button within a set
 */
export interface QuickReplyItem {
  id: string;
  setId: string;
  /** Button label displayed in the UI */
  label: string;
  /** Slash command or literal message to execute */
  command: string;
  /** Display order within the set */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for creating a quick reply set
 */
export interface CreateQuickReplySetPayload {
  name: string;
  scope: 'global' | 'character';
  characterId?: string;
}

/**
 * Payload for creating a quick reply item
 */
export interface CreateQuickReplyItemPayload {
  setId: string;
  label: string;
  command: string;
  sortOrder?: number;
}
