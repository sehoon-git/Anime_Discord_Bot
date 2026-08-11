import type {
  CharacterSelection,
  ConversationReply,
  MemoryConsentUpdate,
  MemorySummary,
  TurnEnvelope,
  VoiceConsentCheck
} from '@anime/contracts';
import type { ConversationApi } from '@anime/voice-worker';
import { createSelineVoiceProfile, selectSelineVoiceProfile } from './seline-voice.js';

type BackendApiClientOptions = {
  baseUrl: string;
  apiKey?: string;
  devEchoMode: boolean;
  fetchImpl?: typeof fetch;
  logger?: DetailLogger;
};

type DetailLogger = {
  detail: (...details: unknown[]) => void;
};

export type BotSettings = {
  guild?: Record<string, unknown> | null;
  channel?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
};

export type PerformanceMetric = {
  discordUserId: string;
  guildId?: string;
  channelId?: string;
  eventType: 'stt' | 'llm' | 'tts' | 'barge_in';
  durationMs: number;
  success: boolean;
  emptyText?: boolean;
  failureCode?: string;
  vadScore?: number;
  captureDurationMs?: number;
};

export type ModelUsageMetric = {
  discordUserId: string;
  guildId?: string;
  channelId?: string;
  modelUsage: {
    creditsUsed: number;
  };
};

export class BackendApiError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`Website bot API request failed (${status}). ${detail}`);
    this.name = 'BackendApiError';
  }
}

/**
 * The website owns shared state.  The Discord process never opens the website
 * database directly; it sends only scoped identifiers and derived metadata to
 * the bot API.  Raw audio and provider secrets are deliberately excluded.
 */
export class BackendApiClient implements ConversationApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: BackendApiClientOptions) {
    this.baseUrl = new URL(options.baseUrl).origin;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createTurn(input: TurnEnvelope): Promise<ConversationReply> {
    if (this.options.devEchoMode) return createDevelopmentReply(input);
    const response = await this.request<unknown>('/api/bot/turn', 'POST', toWebsiteTurn(input));
    const reply = parseConversationReply(response, input.conversationId);
    await this.recordModelUsage({
      discordUserId: input.userId,
      guildId: input.guildId,
      channelId: input.channelId,
      modelUsage: { creditsUsed: 1 }
    });
    return reply;
  }

  async selectCharacter(input: CharacterSelection): Promise<void> {
    // Character selection remains a website-owned setting.  The endpoint is
    // intentionally not guessed here until the website exposes its contract.
    await this.request<void>('/api/bot/settings', 'PATCH', { ...input, discordUserId: input.actorUserId });
  }

  async updateMemoryConsent(input: MemoryConsentUpdate): Promise<void> {
    await this.request<void>('/api/bot/consent', 'POST', { ...input, discordUserId: input.userId });
  }

  async listMemories(input: { guildId?: string; userId: string }): Promise<MemorySummary[]> {
    const params = new URLSearchParams({ discordUserId: input.userId });
    if (input.guildId) params.set('guildId', input.guildId);
    const response = await this.request<unknown>(`/api/bot/memory?${params.toString()}`, 'GET');
    return parseMemories(response);
  }

  async forgetMemories(input: { guildId?: string; userId: string }): Promise<void> {
    await this.request<void>('/api/bot/memory', 'DELETE', { ...input, discordUserId: input.userId });
  }

  async updateMemory(input: { id: string; userId: string; guildId?: string; isPinned?: boolean; deletedAt?: string | null }): Promise<void> {
    await this.request<void>('/api/bot/memory', 'PATCH', { ...input, discordUserId: input.userId });
  }

  async canProcessVoice(input: VoiceConsentCheck): Promise<boolean> {
    if (this.options.devEchoMode) return true;
    const settings = await this.getSettings({ discordUserId: input.userId, guildId: input.guildId, channelId: input.channelId });
    return settings.user?.voice_consent === true && settings.channel?.voice_allowed === true;
  }
  async getSettings(input: { discordUserId: string; guildId?: string; channelId?: string }): Promise<BotSettings> {
    const params = new URLSearchParams({ discordUserId: input.discordUserId });
    if (input.guildId) params.set('guildId', input.guildId);
    if (input.channelId) params.set('channelId', input.channelId);
    const response = await this.request<unknown>(`/api/bot/settings?${params.toString()}`, 'GET');
    return parseSettings(response);
  }

  async recordMetric(input: PerformanceMetric): Promise<void> {
    await this.request<void>('/api/bot/metrics', 'POST', input);
  }

  async recordModelUsage(input: ModelUsageMetric): Promise<void> {
    await this.request<void>('/api/bot/metrics', 'POST', input);
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.options.apiKey) {
      headers.authorization = `Bearer ${this.options.apiKey}`;
    }
    if (body !== undefined) headers['content-type'] = 'application/json';
    const startedAt = performance.now();
    // Headers are intentionally excluded so BOT_SECRET_KEY can never reach logs.
    this.options.logger?.detail(`Bot API -> ${method} ${path}: body=${logBody(body)}.`);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = response.status === 204 ? '' : await response.text().catch(() => '');
    this.options.logger?.detail(`Bot API <- HTTP ${response.status} ${response.statusText || ''} in ${Math.round(performance.now() - startedAt)} ms: body=${logPreview(text)}.`);
    if (!response.ok) throw new BackendApiError(response.status, text);
    if (response.status === 204) return undefined as T;
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

export class DirectGeminiVoiceApi implements ConversationApi {
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
    return { conversationId: input.conversationId, text, voiceProfile: selectSelineVoiceProfile({ userText: input.canonicalText, assistantText: text }) };
  }
}

function logBody(body: unknown): string {
  return logPreview(body === undefined ? '' : JSON.stringify(body));
}

function logPreview(value: string, maxLength = 1_200): string {
  const normalized = value.replace(/[\r\n]+/g, ' ').trim();
  return JSON.stringify(normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength) + '...');
}
function toWebsiteTurn(input: TurnEnvelope): Record<string, unknown> {
  return { ...input, discordUserId: input.userId };
}
function parseConversationReply(value: unknown, conversationId: string): ConversationReply {
  const root = objectOf(value);
  const nestedReply = objectOf(root.reply);
  const candidate = Object.keys(nestedReply).length > 0 ? nestedReply : root;
  if (typeof candidate.text !== 'string') throw new Error('Website bot API returned no reply text.');
  return { conversationId: typeof candidate.conversationId === 'string' ? candidate.conversationId : conversationId, text: candidate.text, voiceProfile: candidate.voiceProfile as ConversationReply['voiceProfile'] };
}
function parseSettings(value: unknown): BotSettings {
  const root = objectOf(value);
  return { guild: objectOf(root.guild), channel: objectOf(root.channel), user: objectOf(root.user) };
}
function parseMemories(value: unknown): MemorySummary[] {
  const root = objectOf(value);
  const rows = Array.isArray(value) ? value : Array.isArray(root.memories) ? root.memories : [];
  return rows.flatMap((item) => {
    const row = objectOf(item);
    const summary = typeof row.summary === 'string' ? row.summary : typeof row.content === 'string' ? row.content : undefined;
    const id = typeof row.id === 'string' ? row.id : undefined;
    if (!id || !summary) return [];
    return [{ id, summary, createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString() }];
  });
}
function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function createDevelopmentReply(input: TurnEnvelope): ConversationReply {
  return { conversationId: input.conversationId, text: `[development mode] ${input.canonicalText}`, voiceProfile: createSelineVoiceProfile() };
}
