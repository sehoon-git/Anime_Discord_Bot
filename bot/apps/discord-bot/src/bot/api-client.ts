import type {
  CharacterSelection,
  ConversationReply,
  MemoryConsentUpdate,
  MemorySummary,
  TurnEnvelope,
  VoiceConsentCheck,
  VoiceConsentUpdate,
  VoiceProfile
} from '@anime/contracts';
import type { ConversationApi } from '@anime/voice-worker';

type BackendApiClientOptions = {
  baseUrl: string;
  devEchoMode: boolean;
  fetchImpl?: typeof fetch;
};

/**
 * 개발자 A의 Conversation API를 향한 유일한 HTTP 클라이언트입니다.
 * 이 클래스 밖에서 Gemini·기억 DB를 직접 호출하지 않습니다.
 */
export class BackendApiClient implements ConversationApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: BackendApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createTurn(input: TurnEnvelope): Promise<ConversationReply> {
    if (this.options.devEchoMode) return createDevelopmentReply(input);
    return this.request<ConversationReply>('/v1/discord/turns', 'POST', input);
  }

  async selectCharacter(input: CharacterSelection): Promise<void> {
    await this.request<void>('/v1/discord/character-selections', 'PUT', input);
  }

  async updateMemoryConsent(input: MemoryConsentUpdate): Promise<void> {
    await this.request<void>('/v1/discord/memory-consents', 'PUT', input);
  }

  async listMemories(input: { guildId?: string; userId: string }): Promise<MemorySummary[]> {
    const params = new URLSearchParams({ userId: input.userId });
    if (input.guildId) params.set('guildId', input.guildId);
    return this.request<MemorySummary[]>(`/v1/discord/memories?${params.toString()}`, 'GET');
  }

  async forgetMemories(input: { guildId?: string; userId: string }): Promise<void> {
    await this.request<void>('/v1/discord/memories', 'DELETE', input);
  }

  async updateVoiceConsent(input: VoiceConsentUpdate): Promise<void> {
    await this.request<void>('/v1/discord/voice-consents', 'PUT', input);
  }

  async canProcessVoice(input: VoiceConsentCheck): Promise<boolean> {
    if (this.options.devEchoMode) return true;
    const response = await this.request<{ allowed: boolean }>('/v1/discord/voice-consents/check', 'POST', input);
    return response.allowed;
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Conversation API 요청 실패 (${response.status}). ${detail}`.trim());
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

function createDevelopmentReply(input: TurnEnvelope): ConversationReply {
  const english = /^[\x00-\x7F\s\p{P}]+$/u.test(input.canonicalText);
  const voiceProfile: VoiceProfile = english
    ? {
        id: 'en-female-heart-v1',
        version: 1,
        provider: 'kokoro',
        language: 'en-US',
        settings: { voice: 'af_heart', speed: 0.95 },
        status: 'published'
      }
    : {
        id: 'default-ko-v1',
        version: 1,
        provider: 'melotts',
        language: 'ko',
        settings: {},
        status: 'published'
      };

  return {
    conversationId: input.conversationId,
    text: `[개발 모드] ${input.canonicalText}`,
    voiceProfile
  };
}

/**
 * 개발 중 Conversation API 없이 Gemini를 직접 호출할 때 쓰는 음성 대화 어댑터다.
 * 동의는 프로세스 메모리에만 유지되며, 운영 환경에서는 BackendApiClient를 사용한다.
 */
export class DirectGeminiVoiceApi implements ConversationApi {
  private readonly voiceConsents = new Set<string>();

  constructor(
    private readonly textApi: {
      createTurn(input: TurnEnvelope): Promise<{ text: string }>;
    }
  ) {}

  async createTurn(input: TurnEnvelope): Promise<ConversationReply> {
    const reply = await this.textApi.createTurn(input);
    return {
      conversationId: input.conversationId,
      text: reply.text,
      voiceProfile: defaultVoiceProfile(input.canonicalText)
    };
  }

  async updateVoiceConsent(input: VoiceConsentUpdate): Promise<void> {
    const key = voiceConsentKey(input);
    if (input.enabled) this.voiceConsents.add(key);
    else this.voiceConsents.delete(key);
  }

  async canProcessVoice(input: VoiceConsentCheck): Promise<boolean> {
    return this.voiceConsents.has(voiceConsentKey(input));
  }
}

function defaultVoiceProfile(text: string): VoiceProfile {
  const english = /^[\x00-\x7F\s\p{P}]+$/u.test(text);
  return english
    ? {
        id: 'en-female-heart-v1',
        version: 1,
        provider: 'kokoro',
        language: 'en-US',
        settings: { voice: 'af_heart', speed: 0.95 },
        status: 'published'
      }
    : {
        id: 'default-ko-v1',
        version: 1,
        provider: 'melotts',
        language: 'ko',
        settings: {},
        status: 'published'
      };
}

function voiceConsentKey(input: VoiceConsentCheck): string {
  return `${input.guildId}:${input.channelId}:${input.userId}`;
}