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

export class BackendApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string
  ) {
    super('Conversation API request failed (' + status + '). ' + detail);
    this.name = 'BackendApiError';
  }
}

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
      throw new BackendApiError(response.status, detail);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

function createDevelopmentReply(input: TurnEnvelope): ConversationReply {
  return {
    conversationId: input.conversationId,
    text: `[development mode] ${input.canonicalText}`,
    voiceProfile: englishVoiceProfile()
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
      streamTurn?(input: TurnEnvelope): AsyncGenerator<{ text: string }, { text: string }, void>;
    }
  ) {}

  async createTurn(input: TurnEnvelope): Promise<ConversationReply> {
    const reply = await this.textApi.createTurn(input);
    return this.toVoiceReply(input, reply.text);
  }

  async *streamTurn(input: TurnEnvelope): AsyncGenerator<ConversationReply, void, void> {
    if (!this.textApi.streamTurn) {
      yield await this.createTurn(input);
      return;
    }

    let text = '';
    try {
      for await (const chunk of this.textApi.streamTurn(input)) {
        text += chunk.text;
        if (chunk.text) yield this.toVoiceReply(input, chunk.text);
      }
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Gemini returned an empty text response.') throw error;
      yield this.toVoiceReply(input, 'I caught part of that, but say it once more for me?');
      return;
    }
    if (text) yield this.toVoiceReply(input, '');
  }

  private toVoiceReply(input: TurnEnvelope, text: string): ConversationReply {
    return {
      conversationId: input.conversationId,
      text,
      voiceProfile: defaultVoiceProfile(input.canonicalText)
    };
  }

  async updateVoiceConsent(input: VoiceConsentUpdate): Promise<void> {
    const key = voiceConsentKey(input);
    if (input.enabled) this.voiceConsents.add(key);
    else this.voiceConsents.delete(key);
  }

  async canProcessVoice(_input: VoiceConsentCheck): Promise<boolean> {
    // BOT_TEST_DIRECT_GEMINI is a local integration mode. Production uses
    // BackendApiClient, which must check the consent recorded by the website.
    return true;
  }
}

function defaultVoiceProfile(_text: string): VoiceProfile {
  return englishVoiceProfile();
}

function englishVoiceProfile(): VoiceProfile {
  return {
    id: 'en-female-seline-expressive-v1',
    version: 1,
    provider: 'gemini',
    language: 'en-US',
    settings: {
      voice: 'Sulafat',
      style: 'A warm, youthful, emotionally perceptive woman in a private one-to-one voice chat. Sound genuinely present, never announcer-like. Let the meaning guide subtle changes in pacing and tone: a quiet smile for playful moments, softness for vulnerable moments, and grounded warmth for serious ones. Use natural conversational pauses and contractions. Keep emotion intimate and believable, never theatrical.'
    },
    status: 'published'
  };
}

function voiceConsentKey(input: VoiceConsentCheck): string {
  return `${input.guildId}:${input.channelId}:${input.userId}`;
}