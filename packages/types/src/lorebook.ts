/**
 * Lorebook / World Info type definitions
 */

/** Position in prompt where lorebook entry content is injected */
export type LorebookPosition =
  | 'before_system'
  | 'after_system'
  | 'before_persona'
  | 'after_persona'
  | 'before_author'
  | 'after_author'
  | 'before_history'
  | 'after_history';

export interface Lorebook {
  id: string;
  name: string;
  description: string;
  scanDepth: number;
  recursiveScan: boolean;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  useGroupScoring: boolean;
  budgetTokens: number;
  minActivations: number;
  maxRecursionSteps: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLorebookPayload {
  name: string;
  description?: string;
  scanDepth?: number;
  recursiveScan?: boolean;
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
  useGroupScoring?: boolean;
  budgetTokens?: number;
  minActivations?: number;
  maxRecursionSteps?: number;
}

export interface UpdateLorebookPayload extends Partial<CreateLorebookPayload> {}

export interface LorebookEntry {
  id: string;
  lorebookId: string;
  keys: string[];
  secondaryKeys: string[];
  content: string;
  enabled: boolean;
  position: LorebookPosition;
  insertionOrder: number;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  regex: boolean;
  constant: boolean;
  selective: boolean;
  excludeRecursion: boolean;
  groupId: string | null;
  cooldownTurns: number | null;
  delayTurns: number | null;
  stickyTurns: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLorebookEntryPayload {
  lorebookId: string;
  keys?: string[];
  secondaryKeys?: string[];
  content?: string;
  enabled?: boolean;
  position?: LorebookPosition;
  insertionOrder?: number;
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
  regex?: boolean;
  constant?: boolean;
  selective?: boolean;
  excludeRecursion?: boolean;
  groupId?: string | null;
  cooldownTurns?: number | null;
  delayTurns?: number | null;
  stickyTurns?: number | null;
}

export interface UpdateLorebookEntryPayload extends Partial<Omit<CreateLorebookEntryPayload, 'lorebookId'>> {}

export type LorebookBindingScope = 'global' | 'character' | 'chat';

export interface LorebookBinding {
  id: string;
  lorebookId: string;
  scope: LorebookBindingScope;
  sourceId: string | null;
  priority: number;
}

export interface CreateLorebookBindingPayload {
  lorebookId: string;
  scope: LorebookBindingScope;
  sourceId?: string | null;
  priority?: number;
}

export interface LorebookAsset {
  id: string;
  lorebookId: string;
  assetType: string;
  path: string;
  createdAt: string;
}

/** Activation context passed to the lorebook engine */
export interface LorebookActivationContext {
  /** Recent chat messages to scan for keywords */
  messages: Array<{ role: string; content: string }>;
  /** Character fields to scan */
  characterFields?: {
    description?: string;
    personality?: string;
    scenario?: string;
    systemPrompt?: string;
  };
  /** Author's note content to scan */
  authorNote?: string;
  /** Turn counter for timed effects */
  currentTurn?: number;
  /** Previously activated entries for timed-effect tracking */
  activationHistory?: Map<string, { lastActivatedTurn: number }>;
}

/** Result of lorebook activation */
export interface LorebookPromptResult {
  /** Entries grouped by prompt position */
  sections: Record<LorebookPosition, string[]>;
  /** Total tokens consumed by activated entries */
  totalTokens: number;
  /** Number of entries activated */
  activatedCount: number;
  /** Debug info about which entries fired and why */
  debugLog: LorebookDebugEntry[];
  /** Whether budget was exceeded */
  budgetExceeded: boolean;
}

export interface LorebookDebugEntry {
  entryId: string;
  lorebookName: string;
  keys: string[];
  matchedKey: string;
  position: LorebookPosition;
  reason: string;
}
