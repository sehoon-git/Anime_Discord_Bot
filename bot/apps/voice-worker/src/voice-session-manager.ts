import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
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
import type { ConversationReply, TurnEnvelope, VoiceConsentCheck, VoiceProfile } from '@anime/contracts';
import { VoiceServiceClient } from './voice-service-client.js';
const VAD_START_CONFIRMATION_MS = 120;
const VAD_MINIMUM_UTTERANCE_MS = 300;
const VAD_SHORT_UTTERANCE_MS = 700;
const VAD_SHORT_SILENCE_MS = 280;
const VAD_LONG_SILENCE_MS = 420;
const VAD_MAX_UTTERANCE_MS = 12_000;
const VAD_INITIAL_NOISE_FLOOR = 120;
const VAD_MIN_RMS = 340;
const VOICE_INPUT_MAX_CHARS = 500;

export type ConversationApi = {
  createTurn(input: TurnEnvelope): Promise<ConversationReply>;
  canProcessVoice(input: VoiceConsentCheck): Promise<boolean>;
  streamTurn?(input: TurnEnvelope): AsyncIterable<ConversationReply>;
};

export type StartVoiceSessionInput = {
  channel: VoiceBasedChannel;
  botUserId: string;
  greeting?: { text: string; voiceProfile: VoiceProfile };
  idleNudge?: { text: string; voiceProfile: VoiceProfile; delayMs?: number; maxCount?: number };
};

export type VoiceTextMessageInput = {
  guildId: string;
  channelId: string;
  userId: string;
  text: string;
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
  capturingUserId?: string;
  activeRequest?: AbortController;
  greetingRequest?: AbortController;
  idleNudgeRequest?: AbortController;
  idleNudgeTimer?: NodeJS.Timeout;
  idleNudge?: { text: string; voiceProfile: VoiceProfile; delayMs: number; maxCount: number };
  lastHumanActivityAt: number;
  idleNudgeCount: number;
  activePlayback?: PcmSpeechPipeline;
  pendingBargeInUserId?: string;
};

type VoiceSessionManagerOptions = {
  conversationApi: ConversationApi;
  voiceService: VoiceServiceClient;
  maxPcmBytes?: number;
  logger?: Pick<Console, 'error' | 'info' | 'warn'>;
  onBargeIn?: (input: { guildId: string; channelId: string; userId: string }) => void | Promise<void>;
};

/**
 * The hot path is deliberately pipelined: adaptive endpointing -> STT -> Gemini
 * SSE -> sentence TTS -> one continuous PCM Discord playback stream.
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
      throw new Error('Only one voice channel can be processed per guild. Leave the existing session first.');
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
      throw new Error(`Could not connect to the voice channel: ${messageOf(error)}`);
    }

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    connection.subscribe(player);
    const session: ActiveVoiceSession = {
      connection,
      player,
      channel: input.channel,
      botUserId: input.botUserId,
      startedAt: new Date().toISOString(),
      idleNudge: input.idleNudge
        ? {
            text: input.idleNudge.text,
            voiceProfile: input.idleNudge.voiceProfile,
            delayMs: input.idleNudge.delayMs ?? 60_000,
            maxCount: input.idleNudge.maxCount ?? 2
          }
        : undefined,
      lastHumanActivityAt: Date.now(),
      idleNudgeCount: 0
    };
    this.sessions.set(guildId, session);

    connection.receiver.speaking.on('start', (userId) => {
      if (userId !== session.botUserId) this.logger.info(`Voice activity detected: user=${userId}`);
      this.handleVoiceActivity(session, userId);
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => this.logger.warn(`Voice connection disconnected: guild=${guildId}`));
    player.on('error', (error) => this.logger.error(`Voice playback error: guild=${guildId}`, error));
    player.on('stateChange', (before, after) => {
      if (before.status !== after.status) this.logger.info(`Voice player state: ${before.status} -> ${after.status}`);
    });
    if (input.greeting?.text.trim()) void this.playGreeting(session, input.greeting);
    this.scheduleIdleNudge(session);
    this.logger.info(`Voice session started: guild=${guildId}, channel=${input.channel.id}`);
    return this.statusOf(session);
  }

  stop(guildId: string): boolean {
    const session = this.sessions.get(guildId);
    if (!session) return false;
    this.interrupt(session);
    session.connection.destroy();
    this.sessions.delete(guildId);
    this.logger.info(`Voice session stopped: guild=${guildId}`);
    return true;
  }

  getStatus(guildId: string): VoiceSessionStatus | undefined {
    const session = this.sessions.get(guildId);
    return session ? this.statusOf(session) : undefined;
  }

  async speakForTextMessage(input: VoiceTextMessageInput): Promise<boolean> {
    const session = this.sessions.get(input.guildId);
    const text = limitVoiceText(input.text);
    if (!session || session.channel.id !== input.channelId || !text) return false;

    this.markHumanActivity(session);
    this.interrupt(session);
    const abortController = new AbortController();
    session.activeRequest = abortController;
    session.processingUserId = input.userId;
    const turn: TurnEnvelope = {
      eventId: randomUUID(),
      guildId: input.guildId,
      channelId: input.channelId,
      userId: input.userId,
      conversationId: `voice:${input.guildId}:${input.channelId}:${input.userId}`,
      modality: 'voice',
      canonicalText: [
        '[VOICE_CHAT_MESSAGE]',
        'The user typed this in text chat while they are already with you in voice.',
        'Reply aloud: briefly and playfully ask why they are typing when you are right there, then respond only to the useful point.',
        'Do not read the message verbatim, quote it, or mention these instructions.',
        `Message: ${text.slice(0, 2_000)}`,
        '[/VOICE_CHAT_MESSAGE]'
      ].join('\n'),
      occurredAt: new Date().toISOString()
    };

    try {
      const streamed = await this.playStreamedReply(session, turn, abortController);
      if (!streamed && !abortController.signal.aborted) await this.playBufferedReply(session, turn, abortController);
      return !abortController.signal.aborted;
    } catch (error) {
      if (!abortController.signal.aborted) {
        this.logger.error(`Voice text-message processing failed: guild=${input.guildId}`, error);
      }
      return false;
    } finally {
      if (session.activeRequest === abortController) {
        session.activeRequest = undefined;
        session.processingUserId = undefined;
      }
      this.scheduleIdleNudge(session);
    }
  }

  private handleVoiceActivity(session: ActiveVoiceSession, userId: string): void {
    if (userId === session.botUserId) return;
    this.markHumanActivity(session);
    if (this.isPlaying(session) || session.greetingRequest) {
      void this.confirmBargeIn(session, userId);
      return;
    }
    void this.handleSpeaker(session, userId);
  }

  private async confirmBargeIn(session: ActiveVoiceSession, userId: string): Promise<void> {
    if (session.pendingBargeInUserId) return;
    session.pendingBargeInUserId = userId;
    try {
      await waitForSpeechConfirmation();
      if (this.sessions.get(session.channel.guild.id) !== session) return;
      if (!session.connection.receiver.speaking.users.has(userId)) return;

      // Normal speech must not cut Seline off. While she is playing, listen
      // only long enough to recognise an explicit interruption request.
      const opus = session.connection.receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 520 }
      });
      const capture = await capturePcmWithVad(opus, this.maxPcmBytes);
      if (!capture.pcm.length || this.sessions.get(session.channel.guild.id) !== session) return;
      const transcription = await this.options.voiceService.transcribe({
        pcm: capture.pcm,
        guildId: session.channel.guild.id,
        channelId: session.channel.id,
        userId
      });
      const request = transcription.text.trim();
      if (!isExplicitInterrupt(request)) {
        this.logger.info('Voice playback continued; no explicit interrupt request was heard.');
        return;
      }

      this.logger.info(`Voice interrupt accepted: user=${userId}`);
      await Promise.resolve(this.options.onBargeIn?.({
        guildId: session.channel.guild.id,
        channelId: session.channel.id,
        userId
      })).catch((error: unknown) => this.logger.warn(`Failed to record voice barge-in: ${messageOf(error)}`));
      this.interrupt(session);
    } catch (error) {
      this.logger.warn(`Voice interrupt check failed: user=${userId}, ${messageOf(error)}`);
    } finally {
      if (session.pendingBargeInUserId === userId) session.pendingBargeInUserId = undefined;
    }
  }
  private isPlaying(session: ActiveVoiceSession): boolean {
    return session.player.state.status === AudioPlayerStatus.Playing || session.player.state.status === AudioPlayerStatus.Buffering;
  }

  private markHumanActivity(session: ActiveVoiceSession): void {
    session.lastHumanActivityAt = Date.now();
    this.cancelIdleNudge(session);
    this.scheduleIdleNudge(session);
  }

  private scheduleIdleNudge(session: ActiveVoiceSession): void {
    const nudge = session.idleNudge;
    if (!nudge || session.idleNudgeCount >= nudge.maxCount || this.sessions.get(session.channel.guild.id) !== session) return;
    this.clearIdleNudgeTimer(session);
    const elapsedMs = Date.now() - session.lastHumanActivityAt;
    const dueMs = Math.max(0, nudge.delayMs - elapsedMs);
    session.idleNudgeTimer = setTimeout(() => {
      session.idleNudgeTimer = undefined;
      void this.playIdleNudge(session);
    }, dueMs);
    session.idleNudgeTimer.unref?.();
  }

  private async playIdleNudge(session: ActiveVoiceSession): Promise<void> {
    const nudge = session.idleNudge;
    if (!nudge || this.sessions.get(session.channel.guild.id) !== session || session.idleNudgeCount >= nudge.maxCount) return;
    if (Date.now() - session.lastHumanActivityAt < nudge.delayMs) {
      this.scheduleIdleNudge(session);
      return;
    }
    if (
      this.isPlaying(session) ||
      session.greetingRequest ||
      session.activeRequest ||
      session.capturingUserId ||
      !session.channel.members.some((member) => !member.user.bot)
    ) {
      session.lastHumanActivityAt = Date.now();
      this.scheduleIdleNudge(session);
      return;
    }

    session.idleNudgeCount += 1;
    session.lastHumanActivityAt = Date.now();
    const controller = new AbortController();
    session.idleNudgeRequest = controller;
    try {
      const audio = await this.options.voiceService.synthesizePcm({
        text: nudge.text,
        voiceProfile: nudge.voiceProfile,
        signal: controller.signal
      });
      if (controller.signal.aborted || this.sessions.get(session.channel.guild.id) !== session) {
        audio.destroy();
        return;
      }
      session.player.play(
        createAudioResource(audio, {
          inputType: StreamType.Raw,
          metadata: { voiceProfileId: nudge.voiceProfile.id }
        })
      );
    } catch (error) {
      if (!controller.signal.aborted) this.logger.warn(`Voice idle nudge failed: ${messageOf(error)}`);
    } finally {
      if (session.idleNudgeRequest === controller) session.idleNudgeRequest = undefined;
      this.scheduleIdleNudge(session);
    }
  }

  private clearIdleNudgeTimer(session: ActiveVoiceSession): void {
    if (session.idleNudgeTimer) clearTimeout(session.idleNudgeTimer);
    session.idleNudgeTimer = undefined;
  }

  private cancelIdleNudge(session: ActiveVoiceSession): void {
    this.clearIdleNudgeTimer(session);
    session.idleNudgeRequest?.abort();
    session.idleNudgeRequest = undefined;
  }

  private async handleSpeaker(
    session: ActiveVoiceSession,
    userId: string,
    options: { deferGreetingInterrupt?: boolean } = {}
  ): Promise<void> {
    if (userId === session.botUserId) return;
    // Discord can emit repeated speaking-start events for one utterance. Do not
    // abort an in-flight capture/STT request when that happens.
    if (session.capturingUserId || session.processingUserId) return;
    if (!options.deferGreetingInterrupt) this.interrupt(session);

    const consent = await this.options.conversationApi.canProcessVoice({
      guildId: session.channel.guild.id,
      channelId: session.channel.id,
      userId
    }).catch((error: unknown) => {
      this.logger.warn(`Voice permission check failed: user=${userId}, ${messageOf(error)}`);
      return false;
    });
    if (!consent || session.processingUserId || session.capturingUserId) return;

    const abortController = new AbortController();
    session.capturingUserId = userId;
    session.activeRequest = abortController;
    const turnStartedAt = performance.now();
    try {
      const opus = session.connection.receiver.subscribe(userId, {
        // This is only a fallback. capturePcmWithVad ends a real utterance at
        // 260 ms of silence, while ignoring brief low-level packet jitter.
        end: { behavior: EndBehaviorType.AfterSilence, duration: 520 }
      });
      const capture = await capturePcmWithVad(opus, this.maxPcmBytes);
      if (!capture.pcm.length || abortController.signal.aborted) {
        this.logger.info(`Voice capture ignored: user=${userId}, reason=${capture.discardReason}, captured=${Math.round(capture.capturedMs)}ms, voiced=${Math.round(capture.voicedMs)}ms, avgRms=${Math.round(capture.averageRms)}, peakRms=${Math.round(capture.peakRms)}.`);
        return;
      }
      this.logger.info(`Voice endpointed in ${elapsedMs(turnStartedAt)} ms (${capture.pcm.length} PCM bytes; captured=${Math.round(capture.capturedMs)}ms, voiced=${Math.round(capture.voicedMs)}ms, avgRms=${Math.round(capture.averageRms)}, peakRms=${Math.round(capture.peakRms)}).`);

      const sttStartedAt = performance.now();
      this.logger.info(`Voice STT started: user=${userId}, timeout=10000ms.`);
      const transcription = await this.options.voiceService.transcribe({
        pcm: capture.pcm,
        guildId: session.channel.guild.id,
        channelId: session.channel.id,
        userId,
        signal: abortController.signal
      });
      const canonicalText = limitVoiceText(transcription.text);
      if (!canonicalText || abortController.signal.aborted) return;
      this.logger.info(`Voice STT completed in ${elapsedMs(sttStartedAt)} ms.`);

      const turn: TurnEnvelope = {
        eventId: randomUUID(),
        guildId: session.channel.guild.id,
        channelId: session.channel.id,
        userId,
        conversationId: `voice:${session.channel.guild.id}:${session.channel.id}:${userId}`,
        modality: 'voice',
        canonicalText,
        occurredAt: new Date().toISOString(),
        sttConfidence: transcription.confidence
      };
      const streamed = await this.playStreamedReply(session, turn, abortController);
      if (!streamed && !abortController.signal.aborted) await this.playBufferedReply(session, turn, abortController);
    } catch (error) {
      if (!abortController.signal.aborted) {
        this.logger.error(`Voice processing failed: guild=${session.channel.guild.id}, user=${userId}`, error);
      }
    } finally {
      if (session.activeRequest === abortController) {
        session.activeRequest = undefined;
        session.capturingUserId = undefined;
        session.processingUserId = undefined;
      }
    }
  }

  private async playStreamedReply(
    session: ActiveVoiceSession,
    turn: TurnEnvelope,
    abortController: AbortController
  ): Promise<boolean> {
    const streamTurn = this.options.conversationApi.streamTurn;
    if (!streamTurn) return false;

    const generationStartedAt = performance.now();
    const sentences = new SentenceBuffer();
    let pipeline: PcmSpeechPipeline | undefined;
    let firstTokenLogged = false;
    for await (const chunk of streamTurn.call(this.options.conversationApi, turn)) {
      if (abortController.signal.aborted) return true;
      if (!firstTokenLogged && chunk.text) {
        firstTokenLogged = true;
        this.logger.info(`Voice LLM first token in ${elapsedMs(generationStartedAt)} ms.`);
      }
      if (!chunk.voiceProfile) continue;
      pipeline ??= this.startPcmPlayback(session, chunk.voiceProfile, abortController.signal);
      for (const sentence of sentences.push(chunk.text)) pipeline.enqueue(sentence);
    }
    if (!pipeline) return true;
    for (const sentence of sentences.flush()) pipeline.enqueue(sentence);
    await pipeline.finish();
    if (session.activePlayback === pipeline) session.activePlayback = undefined;
    return true;
  }

  private async playBufferedReply(session: ActiveVoiceSession, turn: TurnEnvelope, abortController: AbortController): Promise<void> {
    const generationStartedAt = performance.now();
    const reply = await this.options.conversationApi.createTurn(turn);
    if (!reply.text.trim() || !reply.voiceProfile || abortController.signal.aborted) return;
    this.logger.info(`Voice LLM completed in ${elapsedMs(generationStartedAt)} ms (non-streaming fallback).`);
    const audio = await this.options.voiceService.synthesize({
      text: reply.text,
      voiceProfile: reply.voiceProfile,
      signal: abortController.signal
    });
    if (abortController.signal.aborted) {
      audio.destroy();
      return;
    }
    const resource = createAudioResource(audio, { inputType: StreamType.OggOpus, metadata: { voiceProfileId: reply.voiceProfile.id } });
    session.player.play(resource);
  }

  private startPcmPlayback(session: ActiveVoiceSession, profile: VoiceProfile, signal: AbortSignal): PcmSpeechPipeline {
    const output = new PassThrough();
    const resource = createAudioResource(output, { inputType: StreamType.Raw, metadata: { voiceProfileId: profile.id } });
    const pipeline = new PcmSpeechPipeline(output, this.options.voiceService, profile, signal);
    session.activePlayback = pipeline;
    session.player.play(resource);
    return pipeline;
  }

  private async playGreeting(
    session: ActiveVoiceSession,
    greeting: { text: string; voiceProfile: VoiceProfile }
  ): Promise<void> {
    const controller = new AbortController();
    session.greetingRequest = controller;
    try {
      const audio = await this.options.voiceService.synthesizePcm({
        text: greeting.text,
        voiceProfile: greeting.voiceProfile,
        signal: controller.signal
      });
      // A real speaker has priority over the cosmetic greeting.
      if (controller.signal.aborted) {
        audio.destroy();
        return;
      }
      session.player.play(
        createAudioResource(audio, {
          inputType: StreamType.Raw,
          metadata: { voiceProfileId: greeting.voiceProfile.id }
        })
      );
      this.logger.info('Voice greeting playback started.');
    } catch (error) {
      if (!controller.signal.aborted) this.logger.warn(`Voice greeting failed: ${messageOf(error)}`);
    } finally {
      if (session.greetingRequest === controller) session.greetingRequest = undefined;
    }
  }
  private interrupt(session: ActiveVoiceSession): void {
    session.activeRequest?.abort();
    session.activeRequest = undefined;
    session.greetingRequest?.abort();
    session.greetingRequest = undefined;
    this.cancelIdleNudge(session);
    session.processingUserId = undefined;
    session.pendingBargeInUserId = undefined;
    session.activePlayback?.cancel();
    session.activePlayback = undefined;
    if (session.player.state.status !== AudioPlayerStatus.Idle) session.player.stop(true);
  }

  private statusOf(session: ActiveVoiceSession): VoiceSessionStatus {
    return { guildId: session.channel.guild.id, channelId: session.channel.id, startedAt: session.startedAt };
  }
}

class PcmSpeechPipeline {
  private readonly queue: Array<Promise<Readable>> = [];
  private closed = false;
  private cancelled = false;
  private wake?: () => void;
  private readonly drainPromise: Promise<void>;

  constructor(
    private readonly output: PassThrough,
    private readonly voiceService: VoiceServiceClient,
    private readonly profile: VoiceProfile,
    private readonly signal: AbortSignal
  ) {
    this.drainPromise = this.drain();
  }

  enqueue(sentence: string): void {
    const text = sentence.trim();
    if (!text || this.closed || this.cancelled) return;
    // Begin network/TTS work immediately. While one sentence is audible, the
    // next sentence's PCM is already being prepared.
    this.queue.push(this.voiceService.synthesizePcm({ text, voiceProfile: this.profile, signal: this.signal }));
    this.wake?.();
    this.wake = undefined;
  }

  async finish(): Promise<void> {
    this.closed = true;
    this.wake?.();
    this.wake = undefined;
    await this.drainPromise;
  }

  cancel(): void {
    this.cancelled = true;
    this.closed = true;
    this.output.destroy();
    this.wake?.();
    this.wake = undefined;
  }

  private async drain(): Promise<void> {
    try {
      while (!this.cancelled) {
        const promise = await this.next();
        if (!promise) break;
        const stream = await promise;
        for await (const chunk of stream) {
          if (this.cancelled) return;
          if (!this.output.write(chunk)) await once(this.output, 'drain');
        }
      }
      if (!this.cancelled) this.output.end();
    } catch (error) {
      if (!this.cancelled) this.output.destroy(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async next(): Promise<Promise<Readable> | undefined> {
    while (!this.queue.length && !this.closed && !this.cancelled) {
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
    return this.queue.shift();
  }
}

class SentenceBuffer {
  private remainder = '';

  push(delta: string): string[] {
    this.remainder += delta;
    const ready: string[] = [];
    const matcher = /(.+?[.!?]+(?:["'\]\)]*)?)(?=\s|$)/g;
    let match: RegExpExecArray | null;
    let consumed = 0;
    while ((match = matcher.exec(this.remainder))) {
      ready.push(match[1].trim());
      consumed = matcher.lastIndex;
    }
    if (consumed) this.remainder = this.remainder.slice(consumed).trimStart();
    // Do not make a listener wait forever for a model that writes very long
    // clauses without punctuation.
    if (this.remainder.length >= 180) {
      const boundary = this.remainder.lastIndexOf(' ', 160);
      if (boundary > 0) {
        ready.push(this.remainder.slice(0, boundary).trim());
        this.remainder = this.remainder.slice(boundary + 1);
      }
    }
    return ready.filter(Boolean);
  }

  flush(): string[] {
    const final = this.remainder.trim();
    this.remainder = '';
    return final ? [final] : [];
  }
}

type VoiceCapture = {
  pcm: Buffer;
  capturedMs: number;
  voicedMs: number;
  averageRms: number;
  peakRms: number;
  discardReason: 'no-confirmed-speech' | 'too-short' | undefined;
};

async function capturePcmWithVad(opus: Readable, maxPcmBytes: number): Promise<VoiceCapture> {
  const decoder = new prism.opus.Decoder({ rate: 48_000, channels: 2, frameSize: 960 });
  const pcm = opus.pipe(decoder);
  const captured: Buffer[] = [];
  const onset: Buffer[] = [];
  let totalBytes = 0;
  let onsetMs = 0;
  let voicedMs = 0;
  let silenceMs = 0;
  let capturedMs = 0;
  let hasSpeech = false;
  let noiseFloor = VAD_INITIAL_NOISE_FLOOR;
  let rmsTotal = 0;
  let rmsFrames = 0;
  let peakRms = 0;

  try {
    for await (const chunk of pcm) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const durationMs = (buffer.length / (48_000 * 2 * 2)) * 1_000;
      const rms = frameRms(buffer);
      rmsTotal += rms;
      rmsFrames += 1;
      peakRms = Math.max(peakRms, rms);
      const voiced = isVoiceFrame(rms, noiseFloor);

      if (!hasSpeech) {
        if (!voiced) {
          onset.length = 0;
          onsetMs = 0;
          noiseFloor = updateNoiseFloor(noiseFloor, rms);
          continue;
        }
        onset.push(buffer);
        onsetMs += durationMs;
        if (onsetMs < VAD_START_CONFIRMATION_MS) continue;
        hasSpeech = true;
        captured.push(...onset);
        totalBytes += onset.reduce((total, frame) => total + frame.length, 0);
        capturedMs += onsetMs;
        voicedMs += onsetMs;
        onset.length = 0;
        continue;
      }

      totalBytes += buffer.length;
      capturedMs += durationMs;
      if (totalBytes > maxPcmBytes) throw new Error('Voice utterance exceeded the maximum allowed duration.');
      captured.push(buffer);
      if (voiced) {
        voicedMs += durationMs;
        silenceMs = 0;
      } else {
        silenceMs += durationMs;
        noiseFloor = updateNoiseFloor(noiseFloor, rms);
        const endpointMs = voicedMs < VAD_SHORT_UTTERANCE_MS ? VAD_SHORT_SILENCE_MS : VAD_LONG_SILENCE_MS;
        if (silenceMs >= endpointMs) {
          opus.destroy();
          break;
        }
      }
      // A microphone held open by fan or game noise cannot keep one request
      // alive forever. It becomes a bounded utterance instead.
      if (capturedMs >= VAD_MAX_UTTERANCE_MS) {
        opus.destroy();
        break;
      }
    }
  } finally {
    decoder.destroy();
  }

  const averageRms = rmsFrames ? rmsTotal / rmsFrames : 0;
  if (!hasSpeech) {
    return { pcm: Buffer.alloc(0), capturedMs, voicedMs, averageRms, peakRms, discardReason: 'no-confirmed-speech' };
  }
  if (voicedMs < VAD_MINIMUM_UTTERANCE_MS) {
    return { pcm: Buffer.alloc(0), capturedMs, voicedMs, averageRms, peakRms, discardReason: 'too-short' };
  }
  return { pcm: Buffer.concat(captured), capturedMs, voicedMs, averageRms, peakRms, discardReason: undefined };
}

function isVoiceFrame(rms: number, noiseFloor: number): boolean {
  const threshold = Math.max(VAD_MIN_RMS, Math.min(1_200, noiseFloor * 2.4));
  return rms >= threshold;
}

function updateNoiseFloor(current: number, rms: number): number {
  return current * 0.9 + Math.min(rms, 1_000) * 0.1;
}

function frameRms(buffer: Buffer): number {
  let sumSquares = 0;
  const samples = Math.floor(buffer.length / 2);
  for (let offset = 0; offset + 1 < buffer.length; offset += 2) {
    const sample = buffer.readInt16LE(offset);
    sumSquares += sample * sample;
  }
  return samples > 0 ? Math.sqrt(sumSquares / samples) : 0;
}
function limitVoiceText(text: string): string {
  const normalized = text.trim();
  if (normalized.length <= VOICE_INPUT_MAX_CHARS) return normalized;
  const marker = '\n[... middle omitted to stay within the voice budget ...]\n';
  const available = VOICE_INPUT_MAX_CHARS - marker.length;
  const start = Math.floor(available * 0.4);
  return `${normalized.slice(0, start)}${marker}${normalized.slice(-(available - start))}`;
}
function isExplicitInterrupt(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return /\b(?:wait|stop|hold on|hang on|pause|quiet|be quiet)\b/u.test(normalized) || /(\uC7A0\uAE50|\uAE30\uB2E4\uB824|\uBA48\uCD94|\uBA48\uCD88|\uC2A4\uD1B1|\uADF8\uB9CC|\uC870\uC6A9\uD788)/u.test(normalized);
}
function waitForSpeechConfirmation(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 200));
}

function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}