import { Readable } from 'node:stream';
import type { VoiceProfile, VoiceTranscription } from '@anime/contracts';

type VoiceServiceClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

type TranscribeInput = {
  pcm: Buffer;
  guildId: string;
  channelId: string;
  userId: string;
  signal?: AbortSignal;
};

type SynthesizeInput = {
  text: string;
  voiceProfile: VoiceProfile;
  signal?: AbortSignal;
};

/**
 * Python 음성 서비스의 작은 HTTP 경계입니다.
 * 봇은 모델 패키지나 모델 가중치를 직접 읽지 않으며 원본 오디오를 디스크에 저장하지 않습니다.
 */
export class VoiceServiceClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ baseUrl, fetchImpl = fetch }: VoiceServiceClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async transcribe(input: TranscribeInput): Promise<VoiceTranscription> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/transcriptions`, {
      method: 'POST',
      headers: {
        'content-type': 'audio/L16;rate=48000;channels=2',
        'x-guild-id': input.guildId,
        'x-channel-id': input.channelId,
        'x-user-id': input.userId
      },
      body: input.pcm as unknown as BodyInit,
      signal: input.signal
    });

    await assertSuccessful(response, '음성 인식');
    return (await response.json()) as VoiceTranscription;
  }

  async synthesize(input: SynthesizeInput): Promise<Readable> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: input.text, voiceProfile: input.voiceProfile }),
      signal: input.signal
    });

    await assertSuccessful(response, '음성 합성');
    if (!response.body) {
      throw new Error('음성 서비스가 오디오 본문 없이 응답했습니다.');
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('audio/ogg')) {
      throw new Error(`음성 서비스는 Ogg Opus를 반환해야 합니다. 받은 형식: ${contentType || '없음'}`);
    }

    return Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  }
}

async function assertSuccessful(response: Response, operation: string): Promise<void> {
  if (response.ok) return;

  const detail = await response.text().catch(() => '');
  throw new Error(`${operation} 요청이 실패했습니다 (${response.status}). ${detail}`.trim());
}
