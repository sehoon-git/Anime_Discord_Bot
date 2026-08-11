import type { TurnEnvelope } from '@anime/contracts';
import { CHAT_INPUT_MAX_CHARS, limitTextForBudget } from './request-budget.js';
const LIVE_VOICE_RESPONSE_INSTRUCTION = [
  'This is a live voice-call turn. Reply in the same language as the user\'s latest message, using natural spoken phrasing.',
  'For everyday chat, use one short sentence of roughly 6–18 words; use a second sentence only when it adds a real emotional beat or a necessary question.',
  'Lead with a present, human reaction when appropriate, then say the useful thing. Sound like a person sharing the moment, not a helper giving a polished explanation.',
  'Avoid generic AI phrasing, long scene-setting, lists, formal transitions, and self-descriptions such as “in the digital ether.”'
].join(' ');

export type GeminiTokenUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type GeminiTextReply = {
  text: string;
  usage: GeminiTokenUsage;
};

export type GeminiTextStreamChunk = {
  text: string;
};

type LocalContextHooks = {
  contextFor?: (input: TurnEnvelope) => string | undefined | Promise<string | undefined>;
  recordTurn?: (input: TurnEnvelope, reply: GeminiTextReply) => void | Promise<void>;
  recordUsage?: (input: TurnEnvelope, usage: GeminiTokenUsage, model: string) => void | Promise<void>;
};

type DetailLogger = {
  detail: (...details: unknown[]) => void;
};

export class GeminiApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string
  ) {
    super('Gemini API request failed (' + status + '). ' + detail);
    this.name = 'GeminiApiError';
  }
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GeminiTextClient {
  private readonly fetchImpl: typeof fetch;
  private model: string;

  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      maxOutputTokens: number;
      systemInstruction?: string;
      logger?: DetailLogger;
      fetchImpl?: typeof fetch;
    } & LocalContextHooks
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.model = options.model;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  async createTurn(input: TurnEnvelope): Promise<GeminiTextReply> {
    const response = await this.fetchTurn(this.endpoint('generateContent'), input);
    if (!response.ok) await throwGeminiError(response);

    const body = (await response.json()) as GeminiGenerateContentResponse;
    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!text) throw new Error('Gemini returned an empty text response.');
    const reply = this.toReply(text, candidate?.finishReason, body.usageMetadata);
    this.options.logger?.detail(`Gemini API parsed response: text=${logPreview(reply.text)}, usage=${JSON.stringify(reply.usage)}.`);
    await this.record(input, reply);
    await this.recordUsage(input, reply.usage);
    return reply;
  }

  /** Streams Gemini text deltas; return value contains the final normalized reply. */
  async *streamTurn(input: TurnEnvelope): AsyncGenerator<GeminiTextStreamChunk, GeminiTextReply, void> {
    const endpoint = this.endpoint('streamGenerateContent');
    endpoint.searchParams.set('alt', 'sse');
    const response = await this.fetchTurn(endpoint, input);
    if (!response.ok) await throwGeminiError(response);
    if (!response.body) throw new Error('Gemini returned an empty streaming response.');

    let accumulated = '';
    let usage: GeminiGenerateContentResponse['usageMetadata'];
    let finishReason: string | undefined;
    const decoder = new TextDecoder();
    let buffered = '';

    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const event = JSON.parse(line.slice(5).trim()) as GeminiGenerateContentResponse;
        const candidate = event.candidates?.[0];
        const received = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
        const delta = normalizeStreamDelta(accumulated, received);
        if (delta) {
          accumulated += delta;
          this.options.logger?.detail(`Gemini SSE delta: ${logPreview(delta)}.`);
          yield { text: delta };
        }
        usage = event.usageMetadata ?? usage;
        finishReason = candidate?.finishReason ?? finishReason;
      }
    }

    const text = accumulated.trim();
    if (!text) {
      const fallback = await this.createTurn(input);
      yield { text: fallback.text };
      return fallback;
    }
    const reply = this.toReply(text, finishReason, usage);
    this.options.logger?.detail(`Gemini stream completed: text=${logPreview(reply.text)}, usage=${JSON.stringify(reply.usage)}.`);
    await this.record(input, reply);
    await this.recordUsage(input, reply.usage);
    return reply;
  }

  private endpoint(method: 'generateContent' | 'streamGenerateContent'): URL {
    const endpoint = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:${method}`
    );
    endpoint.searchParams.set('key', this.options.apiKey);
    return endpoint;
  }

  private async fetchTurn(endpoint: URL, input: TurnEnvelope): Promise<Response> {
    // Voice turns include a small routing wrapper around the recognized text.
    const inputLimit = input.modality === 'voice' ? 1_500 : CHAT_INPUT_MAX_CHARS;
    const boundedInput = { ...input, canonicalText: limitTextForBudget(input.canonicalText, inputLimit).text };
    const localContext = await this.options.contextFor?.(boundedInput);
    const systemInstruction = [
      this.options.systemInstruction,
      localContext,
      input.modality === 'voice' ? LIVE_VOICE_RESPONSE_INSTRUCTION : undefined
    ].filter(Boolean).join('\n\n');
    const payload = {
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: boundedInput.canonicalText }] }],
      generationConfig: { maxOutputTokens: this.options.maxOutputTokens }
    };
    const startedAt = performance.now();
    // The endpoint contains the key as a query parameter; never print it.
    this.options.logger?.detail(`Gemini API -> POST ${endpoint.pathname}: model=${this.model}, modality=${input.modality}, payload=${logPreview(JSON.stringify(payload), 1_200)}.`);
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    this.options.logger?.detail(`Gemini API <- HTTP ${response.status} ${response.statusText || ''} in ${Math.round(performance.now() - startedAt)} ms.`);
    return response;
  }

  private toReply(
    text: string,
    finishReason: string | undefined,
    usage: GeminiGenerateContentResponse['usageMetadata']
  ): GeminiTextReply {
    const totalTokens = numberOrUndefined(usage?.totalTokenCount);
    if (totalTokens === undefined) throw new Error('Gemini response did not include total token usage.');
    return {
      text: completeTruncatedSentence(text, finishReason),
      usage: {
        promptTokens: numberOrUndefined(usage?.promptTokenCount) ?? 0,
        outputTokens: numberOrUndefined(usage?.candidatesTokenCount) ?? 0,
        totalTokens
      }
    };
  }

  private async record(input: TurnEnvelope, reply: GeminiTextReply): Promise<void> {
    await Promise.resolve(this.options.recordTurn?.(input, reply)).catch(() => undefined);
  }

  private async recordUsage(input: TurnEnvelope, usage: GeminiTokenUsage): Promise<void> {
    await Promise.resolve(this.options.recordUsage?.(input, usage, this.model)).catch(() => undefined);
  }
}

async function throwGeminiError(response: Response): Promise<never> {
  const detail = await response.text().catch(() => '');
  throw new GeminiApiError(response.status, detail);
}

function normalizeStreamDelta(previous: string, received: string): string {
  if (!received) return '';
  return received.startsWith(previous) ? received.slice(previous.length) : received;
}

function completeTruncatedSentence(text: string, finishReason: string | undefined): string {
  if (finishReason !== 'MAX_TOKENS') return text;
  const lastSentenceEnd = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
  return lastSentenceEnd >= 0 ? text.slice(0, lastSentenceEnd + 1).trim() : `${text.trimEnd()}...`;
}

function logPreview(value: string, maxLength = 500): string {
  const normalized = value.replace(/[\r\n]+/g, ' ').trim();
  return JSON.stringify(normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength) + '...');
}
function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}