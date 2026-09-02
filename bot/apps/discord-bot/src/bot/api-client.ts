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
  /** Vercel의 BOT_SECRET_KEY. 브라우저나 Git에는 절대 넣지 않습니다. */
  botSecretKey?: string;
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
    await this.request<{ ok: boolean }>('/api/bot/voice-consent', 'POST', {
      // 웹 API는 Discord 사용자 ID를 기준으로 웹 계정을 찾아 동의를 저장합니다.
      discordUserId: input.userId,
      enabled: input.enabled
    });
  }

  async canProcessVoice(input: VoiceConsentCheck): Promise<boolean> {
    if (this.options.devEchoMode) return true;
    if (!this.options.botSecretKey) {
      throw new Error('BOT_SECRET_KEY가 없어 음성 처리 동의를 확인할 수 없습니다.');
    }

    const params = new URLSearchParams({ discordUserId: input.userId });
    const response = await this.request<{
      ok: boolean;
      account?: { linked?: boolean; voiceConsent?: boolean } | null;
    }>(`/api/bot/account?${params.toString()}`, 'GET');

    // 네트워크·인증·연동 오류는 상위 호출부에서 false로 처리됩니다.
    return response.ok === true
      && response.account?.linked === true
      && response.account.voiceConsent === true;
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.options.botSecretKey) headers.authorization = `Bearer ${this.options.botSecretKey}`;

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
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
