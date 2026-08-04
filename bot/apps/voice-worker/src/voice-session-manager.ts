import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  type AudioPlayer,
  type VoiceConnection
} from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';
import prism from 'prism-media';
import type {
  ConversationReply,
  TurnEnvelope,
  VoiceConsentCheck,
  VoiceProfile
} from '@anime/contracts';
import { VoiceServiceClient } from './voice-service-client.js';

export type ConversationApi = {
  createTurn(input: TurnEnvelope): Promise<ConversationReply>;
  canProcessVoice(input: VoiceConsentCheck): Promise<boolean>;
};

export type StartVoiceSessionInput = {
  channel: VoiceBasedChannel;
  botUserId: string;
};

export type VoiceSessionStatus = {
  guildId: string;
  channelId: string;
  startedAt: string;
};

type ActiveVoiceSession = {
  connection: VoiceConnection;
  player: AudioPlayer;
  channel: VoiceBasedChannel;
  botUserId: string;
  startedAt: string;
  processingUserId?: string;
  activeRequest?: AbortController;
};

type VoiceSessionManagerOptions = {
  conversationApi: ConversationApi;
  voiceService: VoiceServiceClient;
  maxPcmBytes?: number;
  logger?: Pick<Console, 'error' | 'info' | 'warn'>;
};

/**
 * Discord Voice 연결, 메모리 내 PCM 처리, TTS 재생을 한 곳에 모읍니다.
 * 수신 오디오는 STT 요청이 끝난 뒤 즉시 버려지고 파일로 기록하지 않습니다.
 */
export class VoiceSessionManager {
  private readonly sessions = new Map<string, ActiveVoiceSession>();
  private readonly maxPcmBytes: number;
  private readonly logger: Pick<Console, 'error' | 'info' | 'warn'>;

  constructor(private readonly options: VoiceSessionManagerOptions) {
    this.maxPcmBytes = options.maxPcmBytes ?? 12 * 1024 * 1024;
    this.logger = options.logger ?? console;
  }

  async start(input: StartVoiceSessionInput): Promise<VoiceSessionStatus> {
    const guildId = input.channel.guild.id;
    const existing = this.sessions.get(guildId);
    if (existing) {
      if (existing.channel.id === input.channel.id) return this.statusOf(existing);
      throw new Error('이 서버에서는 하나의 음성 채널만 처리할 수 있습니다. 먼저 /voice leave를 실행하세요.');
    }

    const connection = joinVoiceChannel({
      channelId: input.channel.id,
      guildId,
      adapterCreator: input.channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (error) {
      connection.destroy();
      throw new Error(`음성 채널에 연결하지 못했습니다: ${messageOf(error)}`);
    }

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });
    connection.subscribe(player);

    const session: ActiveVoiceSession = {
      connection,
      player,
      channel: input.channel,
      botUserId: input.botUserId,
      startedAt: new Date().toISOString(),
      processingUserId: undefined
    };
    this.sessions.set(guildId, session);

    connection.receiver.speaking.on('start', (userId) => {
      void this.handleSpeaker(session, userId);
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => {
      this.logger.warn(`음성 연결이 끊겼습니다: guild=${guildId}`);
    });
    player.on('error', (error) => {
      this.logger.error(`음성 재생 오류: guild=${guildId}`, error);
    });

    this.logger.info(`음성 세션 시작: guild=${guildId}, channel=${input.channel.id}`);
    return this.statusOf(session);
  }

  stop(guildId: string): boolean {
    const session = this.sessions.get(guildId);
    if (!session) return false;

    session.player.stop(true);
    session.connection.destroy();
    this.sessions.delete(guildId);
    this.logger.info(`음성 세션 종료: guild=${guildId}`);
    return true;
  }

  getStatus(guildId: string): VoiceSessionStatus | undefined {
    const session = this.sessions.get(guildId);
    return session ? this.statusOf(session) : undefined;
  }

  private async handleSpeaker(session: ActiveVoiceSession, userId: string): Promise<void> {
    if (userId === session.botUserId) return;

    // 새 발화는 재생 중인 TTS와 진행 중인 STT/TTS 요청을 즉시 취소한다.
    this.interrupt(session);

    const consent = await this.options.conversationApi
      .canProcessVoice({
        guildId: session.channel.guild.id,
        channelId: session.channel.id,
        userId
      })
      .catch((error: unknown) => {
        this.logger.warn(`음성 동의 확인 실패: user=${userId}, ${messageOf(error)}`);
        return false;
      });
    // 동의 확인이 비동기인 동안 다른 참가자의 발화가 먼저 선택됐으면 현재 발화는 건너뛴다.
    if (!consent || session.processingUserId) return;

    const abortController = new AbortController();
    session.processingUserId = userId;
    session.activeRequest = abortController;

    try {
      const opus = session.connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 500 }
      });
      const pcm = await decodeToPcm(opus, this.maxPcmBytes);
      if (pcm.length === 0 || abortController.signal.aborted) return;

      const transcription = await this.options.voiceService.transcribe({
        pcm,
        guildId: session.channel.guild.id,
        channelId: session.channel.id,
        userId,
        signal: abortController.signal
      });
      const canonicalText = transcription.text.trim();
      if (!canonicalText || abortController.signal.aborted) return;

      const reply = await this.options.conversationApi.createTurn({
        eventId: randomUUID(),
        guildId: session.channel.guild.id,
        channelId: session.channel.id,
        userId,
        conversationId: `voice:${session.channel.guild.id}:${session.channel.id}:${userId}`,
        modality: 'voice',
        canonicalText,
        occurredAt: new Date().toISOString(),
        sttConfidence: transcription.confidence
      });
      if (!reply.text.trim() || !reply.voiceProfile || abortController.signal.aborted) return;

      const audio = await this.options.voiceService.synthesize({
        text: reply.text,
        voiceProfile: reply.voiceProfile,
        signal: abortController.signal
      });
      if (abortController.signal.aborted) {
        audio.destroy();
        return;
      }
      this.playOggOpus(session, audio, reply.voiceProfile);
    } catch (error) {
      if (!abortController.signal.aborted) {
        this.logger.error(`음성 처리 오류: guild=${session.channel.guild.id}, user=${userId}`, error);
      }
    } finally {
      if (session.activeRequest === abortController) {
        session.activeRequest = undefined;
        session.processingUserId = undefined;
      }
    }
  }

  private interrupt(session: ActiveVoiceSession): void {
    session.activeRequest?.abort();
    session.activeRequest = undefined;
    session.processingUserId = undefined;
    if (session.player.state.status !== AudioPlayerStatus.Idle) session.player.stop(true);
  }
  private playOggOpus(session: ActiveVoiceSession, audio: Readable, profile: VoiceProfile): void {
    const resource = createAudioResource(audio, {
      inputType: StreamType.OggOpus,
      metadata: { voiceProfileId: profile.id }
    });
    session.player.play(resource);
  }

  private statusOf(session: ActiveVoiceSession): VoiceSessionStatus {
    return {
      guildId: session.channel.guild.id,
      channelId: session.channel.id,
      startedAt: session.startedAt
    };
  }
}

async function decodeToPcm(opus: Readable, maxPcmBytes: number): Promise<Buffer> {
  const decoder = new prism.opus.Decoder({ rate: 48_000, channels: 2, frameSize: 960 });
  const pcm = opus.pipe(decoder);
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of pcm) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxPcmBytes) {
      opus.destroy();
      decoder.destroy();
      throw new Error('한 번의 음성 발화가 허용된 최대 크기를 넘었습니다.');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
