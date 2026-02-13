/**
 * Group Chat & Multi-Character type definitions
 */

export type GroupActivationStrategy = 'sequential' | 'random' | 'smart';
export type GroupGenerationMode = 'one_at_a_time' | 'all_at_once';

export interface GroupChat {
  id: string;
  name: string;
  characterIds: string[];
  activationStrategy: GroupActivationStrategy;
  allowSelfResponses: boolean;
  replyOrder: string[];
  generationMode: GroupGenerationMode;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupChatPayload {
  name: string;
  characterIds: string[];
  activationStrategy?: GroupActivationStrategy;
  allowSelfResponses?: boolean;
  replyOrder?: string[];
  generationMode?: GroupGenerationMode;
}

export interface UpdateGroupChatPayload extends Partial<CreateGroupChatPayload> {}

export interface ChatGroupBinding {
  id: string;
  chatId: string;
  groupId: string;
}

/** Result of next-speaker selection */
export interface NextSpeakerResult {
  characterId: string;
  reason: string;
}
