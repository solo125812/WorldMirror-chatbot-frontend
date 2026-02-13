/**
 * Chat Branching and Checkpoint type definitions
 * Phase 7 — Week 22
 */

/**
 * Branch metadata for a chat that has been forked
 */
export interface ChatBranch {
  id: string;
  /** The parent chat this branch was forked from */
  parentChatId: string;
  /** The message ID at which the branch diverges */
  branchPointMessageId: string;
  /** The root chat of the branch tree */
  rootChatId: string;
  /** User-provided label for the branch */
  label: string;
  /** Number of messages in this branch */
  messageCount: number;
  createdAt: string;
}

/**
 * A saved checkpoint within a chat for restore points
 */
export interface ChatCheckpoint {
  id: string;
  chatId: string;
  /** The message ID at this checkpoint */
  messageId: string;
  /** User-provided label for the checkpoint */
  label: string;
  createdAt: string;
}

/**
 * Payload for creating a branch from a message
 */
export interface CreateBranchPayload {
  /** Message ID at which to fork */
  messageId: string;
  /** Label for the new branch */
  label: string;
}

/**
 * Payload for creating a checkpoint
 */
export interface CreateCheckpointPayload {
  /** Message ID to checkpoint at */
  messageId: string;
  /** Label for the checkpoint */
  label: string;
}

/**
 * Branch tree node for visualization
 */
export interface BranchTreeNode {
  chatId: string;
  label: string;
  messageCount: number;
  createdAt: string;
  children: BranchTreeNode[];
}
