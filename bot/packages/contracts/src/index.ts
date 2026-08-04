export type TurnModality = 'text' | 'voice';

export type VoiceProvider = 'melotts' | 'kokoro' | 'chatterbox';

export type VoiceProfile = {
  id: string;
  version: number;
  provider: VoiceProvider;
  language: 'ko' | 'en-US';
  settings: Record<string, string | number | boolean>;
  status: 'draft' | 'published' | 'disabled';
};

/**
 * Discord 텍스트와 음성 전사 결과가 Conversation API에 전달하는 공통 형식입니다.
 * 이 객체에는 원본 오디오나 Discord 토큰을 포함하지 않습니다.
 */
export type TurnEnvelope = {
  eventId: string;
  guildId?: string;
  channelId?: string;
  userId: string;
  conversationId: string;
  modality: TurnModality;
  canonicalText: string;
  occurredAt: string;
  sttConfidence?: number;
};

export type ConversationReply = {
  conversationId: string;
  text: string;
  voiceProfile?: VoiceProfile;
};

export type CharacterSelection = {
  guildId: string;
  channelId?: string;
  actorUserId: string;
  characterId: string;
};

export type MemoryConsentUpdate = {
  guildId?: string;
  userId: string;
  enabled: boolean;
};

export type MemorySummary = {
  id: string;
  summary: string;
  createdAt: string;
};

export type VoiceConsentUpdate = {
  guildId: string;
  channelId: string;
  userId: string;
  enabled: boolean;
};

export type VoiceConsentCheck = Pick<VoiceConsentUpdate, 'guildId' | 'channelId' | 'userId'>;

export type VoiceTranscription = {
  text: string;
  confidence?: number;
};
