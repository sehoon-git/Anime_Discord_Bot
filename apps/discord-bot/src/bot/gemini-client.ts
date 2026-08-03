import type { TurnEnvelope } from '@anime/contracts';

export type GeminiTokenUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type GeminiTextReply = {
  text: string;
  usage: GeminiTokenUsage;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

/**
 * 백엔드가 준비되기 전 Discord 봇에서만 쓰는 Gemini 직접 호출 어댑터입니다.
 * 운영 전에는 이 코드를 API 서비스의 LLM 어댑터로 옮기고, 봇은 자체 API만 호출합니다.
 */
export class GeminiTextClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      maxOutputTokens: number;
      fetchImpl?: typeof fetch;
    }
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createTurn(input: TurnEnvelope): Promise<GeminiTextReply> {
    const endpoint = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.options.model)}:generateContent`
    );
    endpoint.searchParams.set('key', this.options.apiKey);

    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: input.canonicalText }] }],
        generationConfig: { maxOutputTokens: this.options.maxOutputTokens }
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Gemini API 요청 실패 (${response.status}). ${detail}`.trim());
    }

    const body = (await response.json()) as GeminiGenerateContentResponse;
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('Gemini가 텍스트 응답을 반환하지 않았습니다.');

    const totalTokens = numberOrUndefined(body.usageMetadata?.totalTokenCount);
    if (totalTokens === undefined) throw new Error('Gemini usageMetadata.totalTokenCount를 받지 못했습니다.');

    return {
      text,
      usage: {
        promptTokens: numberOrUndefined(body.usageMetadata?.promptTokenCount) ?? 0,
        outputTokens: numberOrUndefined(body.usageMetadata?.candidatesTokenCount) ?? 0,
        totalTokens
      }
    };
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
