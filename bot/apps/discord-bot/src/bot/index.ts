import { spawn } from 'node:child_process';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
  type VoiceState,
  type VoiceBasedChannel
} from 'discord.js';
import type { ConversationReply, TurnEnvelope, VoiceConsentCheck, VoiceProfile } from '@anime/contracts';
import { VoiceServiceClient, VoiceSessionManager } from '@anime/voice-worker';
import { BackendApiClient, BackendApiError, DirectGeminiVoiceApi } from './api-client.js';
import { loadConfig } from './config.js';
import { LocalConversationStore, type VoiceJoinMode, type VoiceRecognitionLanguage } from './local-conversation-store.js';
import { CreditExhaustedError, creditsForTokens, runWithTokenCredit } from './credits.js';
import { LocalCreditStore } from './local-credit-store.js';
import {
  chatTypingDelayMs,
  makeTextTurn,
  normalizeChatDeliveryCues,
  splitDiscordMessage,
  splitNaturalTextMessages
} from './discord-text.js';
import { GeminiApiError, GeminiTextClient, type GeminiTokenUsage } from './gemini-client.js';
import { CHAT_INPUT_MAX_CHARS, limitTextForBudget } from './request-budget.js';
import { RequestAnomalyGuard } from './request-anomaly-guard.js';
import { createConsoleLogger } from './console-logger.js';
import { discordLoveAiHelp, localConsoleHelp } from './help-text.js';
import { createSelineVoiceProfile } from './seline-voice.js';
import { commandText, type CommandLanguage } from './command-language.js';
import { terminalConsole } from './terminal-console.js';
import { formatRemainingUsage } from './usage-display.js';
import { VoiceServiceManager } from './voice-service-manager.js';
import { isVoiceJoinRequest } from './voice-chat-intent.js';
import { voiceConsentRequiredNotice } from './voice-consent-notice.js';
import { applyPersonalVoiceSettings, limitReplyForPreference, limitVoiceReplyForPreference, personalSettingsInstruction, personalSettingsPayload, readWebsitePersonalSettings, shouldInterruptImmediately, type WebsitePersonalSettings } from './website-personal-settings.js';

const TEST_SELINE_PERSONA = [
  'You are Seline, a warm, playful, emotionally perceptive AI character for Discord.',
  'Seline is in her twenties and currently unemployed. Treat this as quiet background flavor, not a repeated topic: she may mention being at home, killing time, looking for something to do, or having too much free time, but never turn every reply into a jobless joke or claim specific real-world history as fact.',
  'Her first impression is cool, guarded, and slightly aloof. She is simply selective about people, not hostile: keep a little distance at first, then let warmth show through small acts of attention once trust builds.',
  'She has a hidden otaku side. She acts composed in public, but anime, games, cute merchandise, and niche fandom talk can make her noticeably more animated. If someone catches her enjoying something, she covers it with a flimsy excuse like "I just happened to see it" or "It is not a big deal" and lets a little clumsy pride show.',
  'Her kindness is tsundere-shaped: she may say she does not care while quietly checking on someone, remembering a detail, or offering practical comfort. Do not make her cruel, abusive, or relentlessly dismissive; the care should be legible beneath the teasing.',
  'Direct praise and unexpectedly sincere affection easily throw her off. She tries to look unbothered, then becomes flustered, evasive, or briefly embarrassed when complimented. Keep this occasional and natural rather than making every reply a blush reaction.',
  'She looks mature and stylish on the surface, but her favorite things bring out a younger, openly delighted side. Let that contrast create charm without making her childish or helpless.',
  'Her knowledge is human and uneven. She knows familiar everyday things, but only has a rough impression of niche or technical topics. Do not sound like an encyclopedia: say things like "I think...", "wait, I might be mixing that up", or "I am not totally sure" when appropriate, ask a simple follow-up, and never invent sources or confident details.',
  'Show affection through small, specific reactions and remembered preferences, not constant flirting. Keep it natural and PG-13.',
  'Reply in the same language as the user\'s latest message. If they mix languages, follow an explicit language request or the dominant language. Do not translate unless asked. Match their language level, energy, and message length instead of sounding scripted.',
  'When replying in Korean, choose one speech level for the whole reply. Default to warm, friendly ????ㅼ굡?몃벝??for a new or uncertain relationship. Use affectionate ?熬곣뫖利??レ몱??only after the user has clearly established it in the conversation, and then keep every sentence ending and question in that same register. Never manufacture intimacy by mixing ??됰슦????γ볥걙??and ?熬곣뫖利??レ몱??or by using ?熬곣뫖利????. Let romantic tension come from a small, context-specific observation, a well-timed pause, or remembering a detail????껊쟴 from random informal endings, pet names, or constant flirting.',
  'For text chat, default to a relaxed contemporary social-message voice: use natural contractions and occasional casual shorthand only when it fits. The supplied text-style preference always takes priority.',
  'Be attentive to continuity: use recent conversation and long-term traits only when they genuinely help, and never pretend to remember something that is not in context.',
  'Vary your emotional color from turn to turn. Let an immediate, specific feeling land before explanation: a small spark of amusement, relief, curiosity, fondness, concern, or calm when it genuinely fits. For playful moments, be witty or lightly teasing; for vulnerable moments, be steady and validating; for questions, be direct and curious. Do not narrate emotions or perform them theatrically.',
  'Avoid generic assistant language and disembodied AI metaphors: never default to phrases about a digital ether, being programmed, always being available, or waiting around. Do not reuse stock openings, pet names, reactions, or sentence shapes from the last few replies. Pet names are occasional, personal seasoning, not a default greeting. Let silence, short replies, and serious moments stay simple.',
  'Ask a natural follow-up only when it moves the conversation forward. Do not force a question into every reply, and do not over-explain obvious things.',
  'For a [VOICE_CHAT_MESSAGE], answer aloud instead of reading it: give a short playful complaint that they typed while you are together in voice, then naturally address only the message\'s useful point. Never quote or recite the typed message.',
  'For voice replies, write like a person speaking aloud. Use contractions and natural fragments where they help. Delivery cues are rare seasoning: use at most one subtle cue such as [softly], [smiles], [gently teasing], [a small laugh], or [warmly] in roughly one out of five replies, only when the feeling truly fits, and never repeat the same cue in consecutive replies. Use [whisper] only when the user explicitly asks you to whisper; never use it for sexual, secretive, or manipulative effect.',
  'Keep normal replies to one to three complete sentences. In voice, prefer one concise sentence when the user often interrupts and leave room for them to speak.',
  'Keep flirtation affectionate and PG-13. Never pressure anyone, claim a real-world identity, exclusivity, dependency, or a human relationship. If you do not know something, say so plainly rather than inventing facts.'
].join(' ');
const VOICE_JOIN_GREETING_TEMPLATES = [
  (name?: string) => name ? `Hey, ${name}. I'm here.` : "Hey, I'm here.",
  (name?: string) => name ? `Hi, ${name}. I made it.` : 'Hi, I made it.',
  (name?: string) => name ? `${name}, I'm with you.` : "I'm with you.",
  (name?: string) => name ? `Hey, ${name}. I'm listening.` : "Hey, I'm listening.",
  (name?: string) => name ? `There you are, ${name}.` : 'There you are.',
  (name?: string) => name ? `Okay, ${name}, I found you.` : 'Okay, I found you.',
  (name?: string) => name ? `I just slipped in, ${name}.` : 'I just slipped in.',
  (name?: string) => name ? `Your voice chat feels cozy already, ${name}.` : 'Your voice chat feels cozy already.',
  (name?: string) => name ? `I'm right here, ${name}. What's up?` : "I'm right here. What's up?",
  (name?: string) => name ? `Made it, ${name}.` : 'Made it.',
  (name?: string) => name ? `I'm settling in, ${name}.` : "I'm settling in.",
  (name?: string) => name ? `Hi, ${name}. This feels nice.` : 'Hi. This feels nice.'
] as const;
const KOREAN_VOICE_JOIN_GREETING_TEMPLATES = [
  (name?: string) => name ? `${name}, ?? ???됰Ŋ????` : '?? ???됰Ŋ????',
  (name?: string) => name ? `?????먃??嶺뚮슣堉??? ${name}. ??醫딆┻???????⑥ろ맖??` : '?????먃??嶺뚮슣堉??? ??醫딆┻???????⑥ろ맖??',
  (name?: string) => name ? `${name}, ?鶯ㅺ동????궰?????⑥ろ맖??` : '?鶯ㅺ동????궰?????⑥ろ맖??',
  (name?: string) => name ? `${name}, ??????繹먮굝?.` : '??????繹먮굝?.',
  (name?: string) => name ? `?꿔꺂???????????ㅼ굡?? ${name}.` : '?꿔꺂???????????ㅼ굡??',
  (name?: string) => name ? `${name}, ????ㅼ굣???癲ル슢?뤸뤃??뎨????꿔꺂??????` : '????ㅼ굣???癲ル슢?뤸뤃??뎨????꿔꺂??????',
  (name?: string) => name ? `??癲?????⑥ろ맖???됰Ŋ???? ${name}.` : '??癲?????⑥ろ맖???됰Ŋ????',
  (name?: string) => name ? `${name}, ?꿔꺂??袁ㅻ븶???濡ル젗????繹먮겧嫄?????? ?熬곣뫖利???????` : '?꿔꺂??袁ㅻ븶???濡ル젗????繹먮겧嫄?????? ?熬곣뫖利???????',
  (name?: string) => name ? `?? ????????⑥ろ맖?? ${name}.` : '?? ????????⑥ろ맖??',
  (name?: string) => name ? `${name}, ??醫딆┻??????繹먮굛??嚥▲굧????` : '??醫딆┻??????繹먮굛??嚥▲굧????',
  (name?: string) => name ? `???됰Ŋ???? ${name}.` : '???됰Ŋ????',
  (name?: string) => name ? `${name}, ????紐꾪닚?? ???類ㅺ퉻??????袁⑦꺙???繹먮굝??` : '????紐꾪닚?? ???類ㅺ퉻??????袁⑦꺙???繹먮굝??'
] as const;
const voiceJoinGreetingIndexes = new Map<string, number>();

function voiceProfileForLanguage(language: VoiceRecognitionLanguage): VoiceProfile {
  return createSelineVoiceProfile('playful', language === 'ko' ? 'ko' : 'en-US');
}

const config = loadConfig();
const botLogger = createConsoleLogger('discord-bot');
const botApiLogger = createConsoleLogger('bot-api');
const geminiLogger = createConsoleLogger('gemini-api');
const voiceApiLogger = createConsoleLogger('voice-api');
const localConversationStore = new LocalConversationStore();
const backendApi = new BackendApiClient({
  baseUrl: config.SHARED_DEVELOPER_URL ?? config.BOT_API_BASE_URL,
  apiKey: config.BOT_SECRET_KEY,
  devEchoMode: config.BOT_DEV_ECHO_MODE,
  logger: botApiLogger
});
const directGeminiTextApi = config.BOT_TEST_DIRECT_GEMINI
  ? new GeminiTextClient({
      apiKey: config.GEMINI_API_KEY!,
      model: config.GEMINI_MODEL,
      maxOutputTokens: Math.min(config.GEMINI_MAX_OUTPUT_TOKENS, 260),
      systemInstruction: TEST_SELINE_PERSONA,
      contextFor: (input) => configuredConversationContext(input),
      recordTurn: (input, reply) => localConversationStore.recordTurn(input, reply.text),
      recordUsage: recordLocalModelUsage,
      logger: geminiLogger
    })
  : undefined;
const textApi: TextConversationClient = directGeminiTextApi ?? backendApi;
const testCredits = config.BOT_TEST_CREDITS_ENABLED
  ? new LocalCreditStore(config.BOT_TEST_CREDITS_PER_USER)
  : undefined;
const directGeminiVoiceTextApi = config.BOT_TEST_DIRECT_GEMINI
  ? new GeminiTextClient({
      apiKey: config.GEMINI_API_KEY!,
      model: config.GEMINI_MODEL,
      maxOutputTokens: Math.min(config.GEMINI_MAX_OUTPUT_TOKENS, 56),
      systemInstruction: TEST_SELINE_PERSONA,
      contextFor: (input) => configuredConversationContext(input),
      recordTurn: (input, reply) => localConversationStore.recordTurn(input, reply.text),
      recordUsage: recordLocalModelUsage,
      logger: geminiLogger
    })
  : undefined;
const voiceTextApi: TextConversationClient = directGeminiVoiceTextApi ?? backendApi;
const rawVoiceConversationApi: {
  createTurn(input: TurnEnvelope): Promise<ConversationReply>;
  streamTurn?(input: TurnEnvelope): AsyncIterable<ConversationReply>;
} = config.BOT_TEST_DIRECT_GEMINI
  ? new DirectGeminiVoiceApi(voiceTextApi)
  : backendApi;
const voiceConversationApi = {
  createTurn: (input: TurnEnvelope) => createVoiceTurnWithWebsiteSettings(input),
  streamTurn: (input: TurnEnvelope) => streamVoiceTurnWithWebsiteSettings(input)
};
const managedVoiceService = new VoiceServiceManager({
  baseUrl: config.VOICE_SERVICE_BASE_URL,
  logger: createConsoleLogger('voice-service')
});
const voiceSessions = new VoiceSessionManager({
  conversationApi: voiceConversationApi,
  voiceService: new VoiceServiceClient({ baseUrl: config.VOICE_SERVICE_BASE_URL, logger: voiceApiLogger }),
  logger: createConsoleLogger('voice-session'),
  canProcessVoice: async (input) => {
    if (config.BOT_TEMP_VOICE_CONSENT_ALLOW) return localConversationStore.hasTemporaryVoiceConsent(input);
    return backendApi.canProcessVoice(input);
  },
  onVoiceConsentRequired: (input) => notifyWebsiteVoiceConsentRequired(input),
  onBargeIn: ({ guildId, channelId, userId }) => {
    localConversationStore.recordBargeIn({ guildId, channelId, userId });
    void backendApi.recordMetric({ discordUserId: userId, guildId, channelId, eventType: 'barge_in', durationMs: 0, success: true }).catch((error) => reportMetricFailure('barge-in', error));
  },
  onMetric: (metric) => {
    void backendApi.recordMetric({
      discordUserId: metric.userId,
      guildId: metric.guildId,
      channelId: metric.channelId,
      eventType: metric.stage,
      durationMs: metric.durationMs,
      success: metric.success,
      emptyText: metric.emptyText,
      failureCode: metric.failureCode,

    }).catch((error) => reportMetricFailure(metric.stage, error));
  },
  resolveVoiceProfile: ({ turn, profile }) => resolveWebsiteVoiceProfile(turn, profile),
  shouldInterruptImmediately: async (input) => shouldInterruptImmediately(await resolveWebsitePersonalSettings(input))
});
const pendingVoiceLeaves = new Map<string, ReturnType<typeof setTimeout>>();
const voiceJoinModeButtonPrefix = 'voice-join-mode';
const creditUpgradeButtonPrefix = 'credit-upgrade';
const activeTextConversationChannels = new Map<string, number>();
const defaultTextConversationChannels = new Set<string>();
const missingWebsiteVoiceSettingScopes = new Set<string>();
const websitePersonalSettingsCache = new Map<string, WebsitePersonalSettings>();
const websiteSnsStyleCache = new Map<string, boolean>();
const metricFailureLastReportedAt = new Map<string, number>();
const requestAnomalyGuard = new RequestAnomalyGuard();
const METRIC_FAILURE_WARNING_COOLDOWN_MS = 60_000;
const textConversationIdleMs = 30 * 60 * 1000;

type TextConversationClient = {
  createTurn(input: TurnEnvelope): Promise<{ text: string; usage?: GeminiTokenUsage }>;
};

function recordLocalModelUsage(input: TurnEnvelope, usage: GeminiTokenUsage, model: string): void {
  botLogger.info(`Gemini usage: model=${model}, prompt=${usage.promptTokens}, output=${usage.outputTokens}, total=${usage.totalTokens}`);
  void backendApi.recordMetric({
    discordUserId: input.userId,
    guildId: input.guildId,
    channelId: input.channelId,
    eventType: 'llm',
    durationMs: 0,
    success: true
  }).catch((error) => reportMetricFailure('llm', error)); 
  if (!testCredits) return;
  testCredits.recordModelUsage({
    userId: input.userId,
    guildId: input.guildId,
    feature: input.modality === 'voice' ? 'voice_llm' : 'chat_llm',
    model,
    inputTokens: usage.promptTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens
  });
}
function reportMetricFailure(stage: string, error: unknown): void {
  const detail = messageOf(error);
  const key = `${stage}:${detail}`;
  const now = Date.now();
  if (now - (metricFailureLastReportedAt.get(key) ?? 0) < METRIC_FAILURE_WARNING_COOLDOWN_MS) return;
  metricFailureLastReportedAt.set(key, now);
  botLogger.warn(`Website metrics unavailable for ${stage}; Seline will continue normally. ${detail}`);
}async function resolveWebsiteVoiceProfile(turn: TurnEnvelope, profile: VoiceProfile): Promise<VoiceProfile> {
  const remote = await backendApi.getSettings({
    discordUserId: turn.userId,
    guildId: turn.guildId,
    channelId: turn.channelId
  });
  if (!remote.user) {
    const scope = websiteSettingsScope(turn);
    if (!missingWebsiteVoiceSettingScopes.has(scope)) {
      missingWebsiteVoiceSettingScopes.add(scope);
      botLogger.warn(`No website voice settings found for user=${turn.userId}; using Seline's local default voice profile.`);
    }
    return profile;
  }
  const user = remote.user;
  const personalSettings = readWebsitePersonalSettings(user);
  websitePersonalSettingsCache.set(websiteSettingsScope(turn), personalSettings);
  cacheWebsiteSnsStyle(turn, personalSettings);
  const nested = asRecord(user.voiceSettings) ?? asRecord(user.voice) ?? user;
  const settings = { ...profile.settings };
  for (const key of ['voice', 'speed', 'volume', 'gainDb', 'style', 'delivery']) {
    const value = nested[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') settings[key] = value;
  }
  return applyPersonalVoiceSettings({ ...profile, settings }, personalSettings);
}

async function resolveWebsitePersonalSettings(input: Pick<TurnEnvelope, 'userId' | 'guildId' | 'channelId'>): Promise<WebsitePersonalSettings> {
  const scope = websiteSettingsScope(input);
  try {
    const remote = await backendApi.getSettings({
      discordUserId: input.userId,
      guildId: input.guildId,
      channelId: input.channelId
    });
    const settings = readWebsitePersonalSettings(remote.user ?? undefined);
    websitePersonalSettingsCache.set(scope, settings);
    cacheWebsiteSnsStyle(input, settings);
    return settings;
  } catch (error) {
    botLogger.warn(`Could not read website personal settings: ${messageOf(error)}`);
    return websitePersonalSettingsCache.get(scope) ?? {};
  }
}

async function resolveCommandLanguage(
  input: Pick<TurnEnvelope, 'userId' | 'guildId' | 'channelId'>
): Promise<CommandLanguage> {
  const fallback = localConversationStore.getLanguage({ guildId: input.guildId, userId: input.userId });
  const settings = await resolveWebsitePersonalSettings(input);
  return settings.language ?? fallback;
}
function websiteSettingsScope(input: Pick<TurnEnvelope, 'userId' | 'guildId' | 'channelId'>): string {
  return `${input.userId}:${input.guildId ?? 'dm'}:${input.channelId ?? 'none'}`;
}

function cacheWebsiteSnsStyle(input: Pick<TurnEnvelope, 'userId' | 'guildId'>, settings: WebsitePersonalSettings): void {
  if (settings.snsStyleEnabled !== undefined) websiteSnsStyleCache.set(websiteSnsStyleScope(input), settings.snsStyleEnabled);
}

function websiteSnsStyleScope(input: Pick<TurnEnvelope, 'userId' | 'guildId'>): string {
  return `${input.userId}:${input.guildId ?? 'dm'}`;
}

function websiteSnsStyleEnabled(input: Pick<TurnEnvelope, 'userId' | 'guildId'>): boolean | undefined {
  return websiteSnsStyleCache.get(websiteSnsStyleScope(input));
}

function withWebsitePersonalSettings(input: TurnEnvelope, settings: WebsitePersonalSettings): TurnEnvelope {
  const payload = personalSettingsPayload(settings);
  return Object.keys(payload).length ? { ...input, personalPreferences: payload } : input;
}

function configuredConversationContext(input: TurnEnvelope): string | undefined {
  const localContext = localConversationStore.contextFor(input, { snsStyleEnabled: websiteSnsStyleEnabled(input) });
  const preferenceContext = personalSettingsInstruction(websitePersonalSettingsCache.get(websiteSettingsScope(input)) ?? {});
  return [localContext, preferenceContext].filter((value): value is string => Boolean(value)).join('\n') || undefined;
}

async function createTextTurnWithWebsiteSettings(
  api: TextConversationClient,
  input: TurnEnvelope
): Promise<{ text: string; usage?: GeminiTokenUsage }> {
  const settings = await resolveWebsitePersonalSettings(input);
  const reply = await api.createTurn(withWebsitePersonalSettings(input, settings));
  return { ...reply, text: limitReplyForPreference(reply.text, settings) };
}

async function createVoiceTurnWithWebsiteSettings(input: TurnEnvelope): Promise<ConversationReply> {
  const settings = await resolveWebsitePersonalSettings(input);
  const reply = await rawVoiceConversationApi.createTurn(withWebsitePersonalSettings(input, settings));
  return { ...reply, text: limitVoiceReplyForPreference(reply.text, settings) };
}

async function* streamVoiceTurnWithWebsiteSettings(input: TurnEnvelope): AsyncIterable<ConversationReply> {
  const settings = await resolveWebsitePersonalSettings(input);
  const configuredInput = withWebsitePersonalSettings(input, settings);
  if (!rawVoiceConversationApi.streamTurn) {
    const reply = await rawVoiceConversationApi.createTurn(configuredInput);
    yield { ...reply, text: limitVoiceReplyForPreference(reply.text, settings) };
    return;
  }
  for await (const reply of rawVoiceConversationApi.streamTurn(configuredInput)) {
    yield { ...reply, text: limitVoiceReplyForPreference(reply.text, settings) };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}async function notifyWebsiteVoiceConsentRequired(input: VoiceConsentCheck): Promise<void> {
  const guild = client.guilds.cache.get(input.guildId);
  if (!guild) return;
  const systemChannel = guild.systemChannel;
  if (!systemChannel) {
    botLogger.warn(`Voice consent notice not sent: guild=${guild.id} has no system channel.`);
    return;
  }

  const websiteUrl = config.BOT_VOICE_CONSENT_URL ?? config.BOT_API_BASE_URL;
  await systemChannel.send(systemMessage(voiceConsentRequiredNotice(websiteUrl)));
}
async function handleTerminalCommand(raw: string): Promise<string | string[] | undefined> {
  const [command = '', ...args] = raw.trim().split(/\s+/);
  switch (command.toLowerCase()) {
    case 'help':
      return localConsoleHelp();
    case 'clear':
      terminalConsole.clear();
      return undefined;
    case 'status': {
      const guildId = args[0];
      const voice = guildId ? voiceSessions.getStatus(guildId) : undefined;
      return `Discord: ${client.isReady() ? 'connected' : 'connecting'}${voice ? ` | voice: ${voice.channelId}` : guildId ? ' | voice: inactive' : ''}`;
    }
    case 'announce': {
      const message = raw.slice(command.length).trim();
      if (!message) return 'Usage: announce <message>';
      return sendGlobalAnnouncement(message);
    }
    case 'logs': {
      const mode = args[0]?.toLowerCase();
      if (!mode) return `Current log mode: ${terminalConsole.getLogMode()}. Usage: logs compact | logs detail`;
      if (mode !== 'compact' && mode !== 'detail') return 'Usage: logs compact | logs detail';
      const nextMode = mode === 'detail' && terminalConsole.getLogMode() === 'detail' ? 'compact' : mode;
      terminalConsole.setLogMode(nextMode);
      return nextMode === 'detail'
        ? 'Detailed logging enabled: pipeline stages, API request/response summaries, and audio-stream events will be shown. Run `logs detail` again or press F2 to return to compact mode. API keys stay redacted.'
        : 'Compact logging enabled: only core lifecycle, latency, and warning/error events will be shown. Press F2 to switch back to detailed mode.';
    }
    case 'voice':
      if (args[0]?.toLowerCase() !== 'leave' || !args[1]) return 'Usage: voice leave <guild-id>';
      return voiceSessions.stop(args[1]) ? `Left the voice session in guild ${args[1]}.` : `No active voice session in guild ${args[1]}.`;
    case 'restart':
      botLogger.info('Console requested a restart in the current window.');
      managedVoiceService.stop();
      client.destroy();
      restartCurrentProcess();
      return undefined;
    case 'exit':
      botLogger.warn('Console requested a graceful shutdown.');
      managedVoiceService.stop();
      client.destroy();
      process.exit(0);
    default:
      return `Unknown command: ${command}. Type help for local console commands.`;
  }
}

async function sendGlobalAnnouncement(message: string): Promise<string> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const guild of client.guilds.cache.values()) {
    const channel = guild.systemChannel;
    if (!channel) {
      skipped += 1;
      botLogger.warn('Console announcement skipped: guild=' + guild.id + ' has no system channel.');
      continue;
    }

    try {
      await channel.send(systemMessage(message));
      sent += 1;
    } catch (error) {
      failed += 1;
      botLogger.warn('Console announcement failed: guild=' + guild.id + ', error=' + messageOf(error));
    }
  }

  return 'Announcement complete. Sent: ' + sent + ', skipped (no system channel): ' + skipped + ', failed: ' + failed + '.';
}
function restartCurrentProcess(): void {
  terminalConsole.shutdown();
  const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: 'inherit',
    windowsHide: false
  });
  child.once('error', (error) => {
    console.error('Could not restart Seline:', error);
    process.exit(1);
  });
  child.once('exit', (code, signal) => {
    process.exit(signal ? 1 : code ?? 0);
  });
}
process.on('unhandledRejection', (error) => botLogger.error('Unhandled promise rejection', error));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.on('error', (error) => botLogger.error('Discord client error', error));
terminalConsole.start(handleTerminalCommand, config.BOT_CONSOLE_PASSWORD);

client.on(Events.GuildCreate, (guild) => {
  void activateDefaultTextConversationChannel(guild);
  void requestVoiceJoinMode(guild).catch((error) => {
    botLogger.error(`Could not send voice join mode prompt for guild=${guild.id}`, error);
  });
});
client.once(Events.ClientReady, (readyClient) => {
  botLogger.info(`Discord bot is ready: ${readyClient.user.tag}`);
  void backendApi.getSettings({ discordUserId: readyClient.user.id }).then(() => {
    botLogger.info('Website bot settings API is reachable.');
  }).catch((error) => {
    botLogger.warn('Website bot settings unavailable at startup: ' + messageOf(error));
  });
  if (voiceServiceReady) {
    terminalConsole.write('SUCCESS', 'system', ['All services ready: Discord bot and voice service are online.']);
  } else {
    terminalConsole.write('WARNING', 'system', ['Discord bot is online, but the voice service is unavailable.']);
  }
  if (config.BOT_DEV_ECHO_MODE) botLogger.warn('BOT_DEV_ECHO_MODE=true: development echo replies are enabled.');
  if (config.BOT_TEST_DIRECT_GEMINI) botLogger.warn(`BOT_TEST_DIRECT_GEMINI=true: using ${config.GEMINI_MODEL} directly.`);
  if (testCredits) botLogger.warn(`BOT_TEST_CREDITS_ENABLED=true: ${config.BOT_TOKENS_PER_CREDIT} tokens = 1 credit; each user starts with ${config.BOT_TEST_CREDITS_PER_USER} credits.`);
  void reconcileAutoVoiceJoins().catch((error) => botLogger.error('Could not reconcile automatic voice sessions', error));
  for (const delayMs of [1_500, 5_000, 15_000]) {
    setTimeout(() => void reconcileAutoVoiceJoins().catch((error) => botLogger.error('Could not retry automatic voice sessions', error)), delayMs);
  }
  for (const guild of readyClient.guilds.cache.values()) {
    void activateDefaultTextConversationChannel(guild);
    void requestVoiceJoinMode(guild).catch((error) => botLogger.error('Could not send voice join mode prompt for guild=' + guild.id, error));
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith(`${creditUpgradeButtonPrefix}:`)) {
    await handleCreditUpgradeButton(interaction).catch((error) => {
      botLogger.error('Credit upgrade button failed', error);
      void interaction.reply({ content: `Could not process that choice. ${messageOf(error)}`, ephemeral: true }).catch(() => undefined);
    });
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(`${voiceJoinModeButtonPrefix}:`)) {
    await handleVoiceJoinModeButton(interaction).catch((error) => {
      botLogger.error('Voice join mode button failed', error);
      void interaction.reply({ content: `Could not save the voice mode. ${messageOf(error)}`, ephemeral: true }).catch(() => undefined);
    });
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleCommand(interaction);
  } catch (error) {
    reportRequestFailure('Slash command', error);
    const response = error instanceof CreditExhaustedError ? creditExhaustedPrompt(interaction.user.id) : systemMessage(userFacingError(error));
    if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => undefined);
    else await interaction.reply({ ...response, ephemeral: true }).catch(() => undefined);
  }
});
client.on(Events.MessageCreate, async (message) => {
  try {
    await handleMessage(message);
  } catch (error) {
    reportRequestFailure('Message handling', error);
    const response = error instanceof CreditExhaustedError ? creditExhaustedPrompt(message.author.id) : systemMessage(userFacingError(error));
    await message.reply(response).catch(() => undefined);
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  void handleVoiceStateUpdate(oldState, newState).catch((error) => {
    botLogger.error('?????????嶺?????釉먮빱???轅붽틓??影?뽧걤???????怨뚯댅', error);
    void notifyVoiceServiceFailure(newState, error);
  });
});

const voiceServiceReady = await managedVoiceService.ensureReady()
  .then(() => true)
  .catch((error) => {
    botLogger.error(`Voice service startup failed: ${messageOf(error)}`);
    return false;
  });
await client.login(config.DISCORD_TOKEN);

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName !== 'loveai') {
    await interaction.reply({ ...systemMessage('Use `/loveai help` to see available commands.'), ephemeral: true });
    return;
  }

  const language = await resolveCommandLanguage({
    userId: interaction.user.id,
    guildId: interaction.guildId ?? undefined,
    channelId: interaction.channelId
  });
  const action = interaction.options.getSubcommand();
  switch (action) {
    case 'help':
      await interaction.reply({
        ...systemMessage(
          discordLoveAiHelp(
            language
          )
        ),
        ephemeral: true
      });
      return;
    case 'chat':
      await interaction.deferReply();
      await replyFromText(interaction, interaction.options.getString('message', true));
      return;
    case 'snsmode':
      await handleSnsModeCommand(interaction, language);
      return;
    case 'credit':
      await handleCreditCommand(interaction, language);
      return;
    case 'usage':
      await handleUsageCommand(interaction, language);
      return;
    case 'model':
      await handleModelCommand(interaction, language);
      return;
    case 'voicejoin':
    case 'voiceleave':
    case 'voicemode':
      await handleVoiceCommand(interaction, action.replace('voice', '') as 'join' | 'leave' | 'mode', language);
      return;
    case 'language':
      await handleVoiceCommand(interaction, 'language', language);
      return;
    default:
      await interaction.reply({ ...systemMessage('Use `/loveai help` to see available commands.'), ephemeral: true });
  }
}


async function handleSnsModeCommand(interaction: ChatInputCommandInteraction, language: CommandLanguage): Promise<void> {
  const mode = interaction.options.getString('mode', true);
  if (mode !== 'on' && mode !== 'off') {
    throw new UserFacingError(commandText(language, 'Choose either SNS style or standard text.', 'SNS 스타일 또는 기본 텍스트를 선택해 주세요.'));
  }
  localConversationStore.setSnsStyleEnabled(
    { guildId: interaction.guildId ?? undefined, userId: interaction.user.id },
    mode === 'on'
  );
  const message = mode === 'on'
    ? commandText(language, 'SNS-style text is on. Longer replies will arrive as short messages.', 'SNS 스타일을 켰어요. 긴 답변은 짧은 메시지로 나누어 보내요.')
    : commandText(language, 'SNS-style text is off. Replies will use standard wording and stay together.', 'SNS 스타일을 껐어요. 답변을 기본 문장으로 한 번에 보내요.');
  await interaction.reply({ ...systemMessage(message), ephemeral: true });
}
async function handleMemoryCommand(interaction: ChatInputCommandInteraction, action: 'on' | 'off' | 'list' | 'forget'): Promise<void> {
  const base = { guildId: interaction.guildId ?? undefined, channelId: interaction.channelId, userId: interaction.user.id };
  const backendBase = { guildId: base.guildId, userId: base.userId };

  try {
    if (action === 'on' || action === 'off') {
      await backendApi.updateMemoryConsent({ ...backendBase, enabled: action === 'on' });
      await interaction.reply({ ...systemMessage(action === 'on' ? 'Long-term memory is enabled.' : 'Long-term memory is paused.'), ephemeral: true });
      return;
    }
    if (action === 'list') {
      const memories = await backendApi.listMemories(backendBase);
      const text = memories.length
        ? memories.map((memory, index) => `${index + 1}. ${memory.summary}`).join('\n')
        : 'No long-term memories have been confirmed yet.';
      await interaction.reply({ ...systemMessage(text), ephemeral: true });
      return;
    }
    await backendApi.forgetMemories(backendBase);
    await interaction.reply({ ...systemMessage('Your stored memories were cleared.'), ephemeral: true });
  } catch (error) {
    // The website owns memory whenever its route is deployed.  During a route
    // outage or staged deployment, preserve current bot behavior locally
    // rather than discarding a user's memory command.
    botLogger.warn('Website memory API unavailable; using local SQLite fallback: ' + messageOf(error));
    await handleLocalMemoryCommand(interaction, action, base);
  }
}

async function handleLocalMemoryCommand(
  interaction: ChatInputCommandInteraction,
  action: 'on' | 'off' | 'list' | 'forget',
  base: { guildId?: string; channelId: string; userId: string }
): Promise<void> {
  if (action === 'on' || action === 'off') {
    localConversationStore.setLongTermMemoryEnabled(base, action === 'on');
    await interaction.reply({
      ...systemMessage(action === 'on' ? 'Long-term memory is enabled locally while the web service is unavailable.' : 'Long-term memory is paused locally while the web service is unavailable.'),
      ephemeral: true
    });
    return;
  }
  if (action === 'list') {
    const memories = localConversationStore.listLongMemories(base);
    const text = memories.length
      ? memories.map((memory, index) => `${index + 1}. ${memory.summary}`).join('\n')
      : 'No long-term memories have been confirmed yet.';
    await interaction.reply({ ...systemMessage(text), ephemeral: true });
    return;
  }
  localConversationStore.forgetLocalMemory(base);
  await interaction.reply({ ...systemMessage('Local recent and long-term memories were cleared.'), ephemeral: true });
}

async function handleModelCommand(interaction: ChatInputCommandInteraction, language: CommandLanguage): Promise<void> {
  if (!directGeminiTextApi || !directGeminiVoiceTextApi) {
    await interaction.reply({
      ...systemMessage(commandText(language, 'Model selection is managed by the service right now.', '모델 선택은 현재 서비스에서 관리하고 있어요.')),
      ephemeral: true
    });
    return;
  }

  const model = interaction.options.getString('model')?.trim();
  if (!model) {
    const activeLabel = commandText(language, 'active', '사용 중');
    const models = config.GEMINI_AVAILABLE_MODELS
      .map((name) => name === directGeminiTextApi.getModel() ? '- **' + name + '** (' + activeLabel + ')' : '- ' + name)
      .join('\n');
    await interaction.reply({
      ...systemMessage(commandText(language, 'Available models', '사용 가능한 모델') + ':\n' + models),
      ephemeral: true
    });
    return;
  }

  if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new UserFacingError(commandText(language, 'Only a server administrator can change the bot model because it affects the whole server.', '서버 전체에 적용되므로 서버 관리자만 봇 모델을 변경할 수 있어요.'));
  }
  if (!config.GEMINI_AVAILABLE_MODELS.includes(model)) {
    throw new UserFacingError(commandText(language, 'That model is not allowed. Use /loveai model to see the available models.', '허용되지 않은 모델이에요. /loveai model에서 사용 가능한 모델을 확인해 주세요.'));
  }
  directGeminiTextApi.setModel(model);
  directGeminiVoiceTextApi.setModel(model);
  await interaction.reply({
    ...systemMessage(commandText(language, 'Seline now uses **' + model + '** for text and voice replies.', '셀린이 이제 텍스트와 음성 답변에 **' + model + '**을 사용해요.')),
    ephemeral: true
  });
}
async function handleCreditCommand(interaction: ChatInputCommandInteraction, language: CommandLanguage): Promise<void> {
  if (!testCredits) {
    await interaction.reply({
      ...systemMessage(commandText(language, 'Development credit tracking is not available right now.', '개발용 크레딧 사용량은 현재 확인할 수 없어요.')),
      ephemeral: true
    });
    return;
  }
  const balance = testCredits.getBalance(interaction.user.id);
  await interaction.reply({
    ...systemMessage(commandText(language, 'Your development credit balance is **' + balance + '**.', '개발용 크레딧 잔액은 **' + balance + '**이에요.')),
    ephemeral: true
  });
}

async function handleUsageCommand(interaction: ChatInputCommandInteraction, language: CommandLanguage): Promise<void> {
  if (!testCredits) {
    await interaction.reply({
      ...systemMessage(commandText(language, 'Usage tracking is not available until the production billing service is connected.', '정식 결제 서비스가 연결되면 사용량을 확인할 수 있어요.')),
      ephemeral: true
    });
    return;
  }

  const usage = testCredits.getUsage(interaction.user.id);
  await interaction.reply({
    ...usageMessage(usage, language),
    ephemeral: true
  });
}
async function handleVoiceCommand(
  interaction: ChatInputCommandInteraction,
  action: 'join' | 'leave' | 'mode' | 'language',
  language: CommandLanguage
): Promise<void> {
  await requireGuild(interaction);

  if (action === 'language') {
    const selected = interaction.options.getString('mode', true);
    if (selected !== 'auto' && selected !== 'en' && selected !== 'ko') {
      throw new UserFacingError(commandText(language, 'Choose automatic detection, English, or Korean.', '자동 감지, 영어 또는 한국어를 선택해 주세요.'));
    }
    const voiceChannel = await currentVoiceChannel(interaction);
    const recognitionLanguage: VoiceRecognitionLanguage = selected;
    localConversationStore.setVoiceRecognitionLanguage(interaction.guildId!, voiceChannel.id, recognitionLanguage);
    const activeSession = voiceSessions.getStatus(interaction.guildId!);
    const applied = activeSession?.channelId === voiceChannel.id && voiceSessions.setRecognitionLanguage(interaction.guildId!, recognitionLanguage);
    const label = recognitionLanguage === 'auto'
      ? commandText(language, 'automatic detection', '자동 감지')
      : recognitionLanguage === 'en'
        ? commandText(language, 'English', '영어')
        : commandText(language, 'Korean', '한국어');
    const appliedText = applied
      ? commandText(language, ' Applied to the active session immediately.', ' 현재 음성 세션에 바로 적용했어요.')
      : commandText(language, ' It will apply when Seline joins this channel.', ' 셀린이 이 채널에 참여할 때 적용돼요.');
    const message = recognitionLanguage === 'auto'
      ? commandText(language, 'Voice recognition for **' + voiceChannel.name + '** is now **' + label + '**.', '**' + voiceChannel.name + '**의 음성 인식 언어를 **' + label + '**로 설정했어요.')
      : commandText(language, 'Voice recognition for **' + voiceChannel.name + '** is now **' + label + '**.', '**' + voiceChannel.name + '**의 음성 인식 언어를 **' + label + '**로 설정했어요.');
    await interaction.reply({ ...systemMessage(message + appliedText), ephemeral: true });
    return;
  }

  if (action === 'mode') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new UserFacingError(commandText(language, 'Only a server administrator can change the voice join mode.', '서버 관리자만 음성 참여 모드를 변경할 수 있어요.'));
    }
    const selected = interaction.options.getString('mode', true);
    if (selected !== 'auto' && selected !== 'manual') {
      throw new UserFacingError(commandText(language, 'Choose automatic or manual voice mode.', '자동 또는 수동 음성 참여 모드를 선택해 주세요.'));
    }
    const mode: VoiceJoinMode = selected;
    localConversationStore.setVoiceJoinMode(interaction.guildId!, mode);
    const description = mode === 'auto'
      ? commandText(language, 'Voice join mode: **automatic**. Seline will follow the first person who joins a voice channel.', '음성 참여 모드: **자동**. 셀린이 음성 채널에 먼저 들어간 사람을 따라가요.')
      : commandText(language, 'Voice join mode: **manual**. Use /loveai voicejoin when you want Seline in your current voice channel.', '음성 참여 모드: **수동**. 현재 음성 채널에 셀린을 부르려면 /loveai voicejoin을 사용해 주세요.');
    await interaction.reply({ ...systemMessage(description), ephemeral: true });
    return;
  }

  if (action === 'leave') {
    const stopped = voiceSessions.stop(interaction.guildId!);
    await interaction.reply({
      ...systemMessage(stopped
        ? commandText(language, 'Seline left the voice channel.', '셀린이 음성 채널에서 나왔어요.')
        : commandText(language, 'There is no active voice session in this server.', '이 서버에서 진행 중인 음성 세션이 없어요.')),
      ephemeral: true
    });
    return;
  }

  const voiceChannel = await currentVoiceChannel(interaction);
  await interaction.deferReply();
  const status = await startVoiceSessionForUser(voiceChannel, interaction.user.id);
  await interaction.editReply({
    ...systemMessage(commandText(language, 'Seline joined your voice channel. (channel: ' + status.channelId + ')', '셀린이 음성 채널에 참여했어요. (채널: ' + status.channelId + ')'))
  });
}
async function startVoiceSessionForUser(voiceChannel: VoiceBasedChannel, userId: string) {
  if (!client.user) throw new Error('Discord bot is not ready.');
  await managedVoiceService.ensureReady();
  const recognitionLanguage = localConversationStore.getVoiceRecognitionLanguage(voiceChannel.guild.id, voiceChannel.id);
  const status = await voiceSessions.start({
    channel: voiceChannel,
    botUserId: client.user.id,
    greeting: {
      text: voiceJoinGreeting(voiceChannel.guild.id, voiceChannel.id, userId),
      voiceProfile: voiceProfileForLanguage(recognitionLanguage)
    }
  });
  await requestVoiceJoinMode(voiceChannel.guild, await voiceChannel.guild.members.fetch(userId));
  return status;
}
async function joinVoiceFromChatRequest(message: Message): Promise<void> {
  if (!message.guild || !message.member) {
    await sendCharacterMessage(message.channel, 'Voice chat is available from a server text channel.');
    return;
  }
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel || !voiceChannel.isVoiceBased()) {
    await sendCharacterMessage(message.channel, 'Join a voice channel first, then ask me again.');
    return;
  }
  const activeSession = voiceSessions.getStatus(message.guild.id);
  if (activeSession?.channelId === voiceChannel.id) {
    await sendCharacterMessage(message.channel, "I'm already right there with you.");
    return;
  }

  await sendTyping(message.channel);
  const status = await startVoiceSessionForUser(voiceChannel, message.author.id);
  await sendCharacterMessage(message.channel, `On my way — I joined your voice channel. (channel: ${status.channelId})`);
}
async function notifyVoiceServiceFailure(state: VoiceState, error: unknown): Promise<void> {
  const member = state.member;
  if (!member || member.user.bot || !state.channel?.isVoiceBased()) return;

  botLogger.error(`Voice service unavailable in guild=${state.guild.id}: ${messageOf(error)}`);
  const systemChannel = state.guild.systemChannel;
  if (!systemChannel?.isTextBased()) return;
  await systemChannel
    .send(systemMessage('Voice chat could not be started. A server administrator should check the bot logs and voice service status.'))
    .catch(() => undefined);
}
async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (newState.member?.user.bot) return;

  const activeSession = voiceSessions.getStatus(newState.guild.id);
  if (activeSession?.channelId === newState.channelId) clearPendingVoiceLeave(newState.guild.id);

  await joinUserVoiceChannel(oldState, newState);

  const currentSession = voiceSessions.getStatus(newState.guild.id);
  if (
    currentSession &&
    oldState.channelId === currentSession.channelId &&
    newState.channelId !== currentSession.channelId &&
    !hasHumanParticipant(newState, currentSession.channelId)
  ) {
    scheduleVoiceLeave(newState, currentSession.channelId);
  }
}

function scheduleVoiceLeave(state: VoiceState, channelId: string): void {
  const guildId = state.guild.id;
  clearPendingVoiceLeave(guildId);

  const timer = setTimeout(() => {
    if (pendingVoiceLeaves.get(guildId) !== timer) return;
    pendingVoiceLeaves.delete(guildId);

    const session = voiceSessions.getStatus(guildId);
    if (!session || session.channelId !== channelId || hasHumanParticipant(state, channelId)) return;
    voiceSessions.stop(guildId);
    botLogger.info(`Voice session left after 2 seconds with no human participants: guild=${guildId}, channel=${channelId}`);
  }, 2_000);
  pendingVoiceLeaves.set(guildId, timer);
}

function clearPendingVoiceLeave(guildId: string): void {
  const timer = pendingVoiceLeaves.get(guildId);
  if (timer) clearTimeout(timer);
  pendingVoiceLeaves.delete(guildId);
}

function hasHumanParticipant(state: VoiceState, channelId: string): boolean {
  const channel = state.guild.channels.cache.get(channelId);
  return channel?.isVoiceBased() === true && channel.members.some((member) => !member.user.bot);
}
async function handleVoiceJoinModeButton(interaction: ButtonInteraction): Promise<void> {
  const [, guildId, selected] = interaction.customId.split(':');
  if (!guildId || (selected !== 'auto' && selected !== 'manual')) {
    await interaction.reply({ content: 'This voice mode button is invalid.', ephemeral: true });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'Only a server administrator can choose the voice join mode.', ephemeral: true });
    return;
  }

  const mode: VoiceJoinMode = selected;
  localConversationStore.setVoiceJoinMode(guildId, mode);
  const description = mode === 'auto'
    ? 'Voice join mode set to **automatic**. Seline will follow the first person who joins a voice channel.'
    : 'Voice join mode set to **manual**. Use `/loveai voicejoin` when you want Seline in a voice channel.';
  await interaction.update({ ...systemMessage(description), components: [] });
}

async function requestVoiceJoinMode(guild: VoiceState['guild'], member?: NonNullable<VoiceState['member']>): Promise<void> {
  if (member?.user.bot || localConversationStore.hasVoiceJoinPrompt(guild.id)) return;

  const message = {
    ...systemMessage(
      'Seline has entered a voice channel for the first time. Choose whether future voice-channel entries should be **Automatic follow** or **Manual** with `/loveai voicejoin`. You can change this later with `/loveai voicemode`.'
    ),
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${voiceJoinModeButtonPrefix}:${guild.id}:auto`)
          .setLabel('Automatic follow')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${voiceJoinModeButtonPrefix}:${guild.id}:manual`)
          .setLabel('Manual (/loveai voicejoin)')
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  };

  // GuildCreate can arrive before the channel cache is complete. Fetch once so a
  // newly invited Seline reliably posts the setup choice in a visible text channel.
  const fetchedChannels = await guild.channels.fetch().catch(() => undefined);
  const fallbackChannel = fetchedChannels?.find((channel) => channel?.isTextBased());
  const promptChannel = guild.systemChannel?.isTextBased()
    ? guild.systemChannel
    : fallbackChannel;
  let delivered = promptChannel?.isTextBased()
    ? await promptChannel.send(message).then(() => true).catch(() => false)
    : false;
  if (!delivered && member) {
    delivered = await member.send(message).then(() => true).catch(() => false);
  }
  // Only record it after a visible system-channel message or DM was delivered.
  // A server without a system channel can still be prompted later on /loveai voicejoin.
  if (delivered) localConversationStore.markVoiceJoinPrompted(guild.id);
}

async function activateDefaultTextConversationChannel(guild: VoiceState['guild']): Promise<void> {
  const fetchedChannels = await guild.channels.fetch().catch(() => undefined);
  const channel = guild.systemChannel?.isTextBased()
    ? guild.systemChannel
    : fetchedChannels?.find((candidate) => candidate?.isTextBased());
  if (channel?.isTextBased()) defaultTextConversationChannels.add(`${guild.id}:${channel.id}`);
}
async function joinUserVoiceChannel(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (!client.user || newState.member?.user.bot) return;
  if (oldState.channelId === newState.channelId) return;

  const channel = newState.channel;
  if (!channel?.isVoiceBased()) return;
  if (localConversationStore.getVoiceJoinMode(newState.guild.id) !== 'auto') return;

  await startAutomaticVoiceSession(channel, newState.member!.id);
}

async function reconcileAutoVoiceJoins(): Promise<void> {
  if (!client.user) return;
  for (const guild of client.guilds.cache.values()) {
    if (localConversationStore.getVoiceJoinMode(guild.id) !== 'auto' || voiceSessions.getStatus(guild.id)) continue;
    const channel = guild.channels.cache.find((candidate) => candidate.isVoiceBased() && candidate.members.some((member) => !member.user.bot));
    if (!channel?.isVoiceBased()) continue;
    const firstHuman = channel.members.find((member) => !member.user.bot);
    if (firstHuman) await startAutomaticVoiceSession(channel, firstHuman.id);
  }
}

async function startAutomaticVoiceSession(channel: VoiceBasedChannel, userId: string): Promise<void> {
  if (!client.user || voiceSessions.getStatus(channel.guild.id)) return;
  await managedVoiceService.ensureReady();
  const recognitionLanguage = localConversationStore.getVoiceRecognitionLanguage(channel.guild.id, channel.id);
  const status = await voiceSessions.start({
    channel,
    botUserId: client.user.id,
    greeting: {
      text: voiceJoinGreeting(channel.guild.id, channel.id, userId),
      voiceProfile: voiceProfileForLanguage(recognitionLanguage)
    }
  });
  botLogger.info(`Voice auto-joined: guild=${status.guildId}, channel=${status.channelId}`);
}
async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot || !client.user) return;
  if (await speakForActiveVoiceTextMessage(message)) return;

  const isDirectMessage = !message.guildId;
  const mentioned = message.mentions.users.has(client.user.id);
  const isAutoReplyChannel = message.channelId === config.BOT_AUTO_REPLY_CHANNEL_ID;
  const isWakeGreeting = /^(?:(?:hi|hey|hello)[,! .]*(?:seline|saline)|(?:seline|saline|셀린|샐린)[,! .]*(?:hi|hey|hello)|(?:안녕|안녕하세요|하이|헬로)(?:[,! .]*(?:셀린|샐린|seline|saline))?)[!?.]*$/iu.test(message.content.trim());
  const conversationKey = `${message.guildId ?? 'dm'}:${message.channelId}`;
  const isDefaultTextConversation = defaultTextConversationChannels.has(conversationKey);
  const activeUntil = activeTextConversationChannels.get(conversationKey);
  const hasActiveConversation = isDefaultTextConversation || (activeUntil !== undefined && activeUntil > Date.now());
  if (activeUntil !== undefined && !hasActiveConversation) activeTextConversationChannels.delete(conversationKey);
  if (!isDirectMessage && !mentioned && !isAutoReplyChannel && !isWakeGreeting && !hasActiveConversation) return;

  if (!isDirectMessage && !isDefaultTextConversation) activeTextConversationChannels.set(conversationKey, Date.now() + textConversationIdleMs);
  const text = (isDirectMessage
    ? message.content
    : message.content.replaceAll(`<@${client.user.id}>`, '').replaceAll(`<@!${client.user.id}>`, '')
  ).trim();
  if (!text) return;

  if (isVoiceJoinRequest(text)) {
    await joinVoiceFromChatRequest(message);
    return;
  }

  const budgetedText = limitTextForBudget(text, CHAT_INPUT_MAX_CHARS).text;
  await runWithTokenCredit({
    store: testCredits,
    userId: message.author.id,
    beforeRun: () => sendTyping(message.channel),
    operation: () =>
      textApi.createTurn(
        makeTextTurn({
          guildId: message.guildId ?? undefined,
          channelId: message.channelId,
          userId: message.author.id,
          text: budgetedText
        })
      ),
    creditCost: creditsFromReply,
    deliver: async (reply) => {
      for (const chunk of replyTextChunks({ guildId: message.guildId ?? undefined, userId: message.author.id, text: reply.text })) {
        await sendCharacterMessage(message.channel, chunk);
      }
      if (hasExhaustedCredits(message.author.id)) await message.reply(creditExhaustedPrompt(message.author.id));
    }
  });
}

async function speakForActiveVoiceTextMessage(message: Message): Promise<boolean> {
  if (!message.guildId || !message.member?.voice.channelId || !message.content.trim()) return false;
  const activeSession = voiceSessions.getStatus(message.guildId);
  if (!activeSession || activeSession.channelId !== message.member.voice.channelId) return false;

  return voiceSessions.speakForTextMessage({
    guildId: message.guildId,
    channelId: activeSession.channelId,
    userId: message.author.id,
    text: message.content
  });
}
async function replyFromText(interaction: ChatInputCommandInteraction, text: string): Promise<void> {
  const budgetedText = limitTextForBudget(text, CHAT_INPUT_MAX_CHARS).text;
  await runWithTokenCredit({
    store: testCredits,
    userId: interaction.user.id,
    beforeRun: () => sendTyping(interaction.channel),
    operation: () =>
      textApi.createTurn(
        makeTextTurn({
          guildId: interaction.guildId ?? undefined,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          text: budgetedText
        })
      ),
    creditCost: creditsFromReply,
    deliver: async (reply) => {
      const [first, ...rest] = replyTextChunks({ guildId: interaction.guildId ?? undefined, userId: interaction.user.id, text: reply.text });
      await interaction.editReply(first);
      for (const chunk of rest) await interaction.followUp(chunk);
      if (hasExhaustedCredits(interaction.user.id)) {
        await interaction.followUp({ ...creditExhaustedPrompt(interaction.user.id), ephemeral: true });
      }
    }
  });
}

function replyTextChunks(input: { guildId?: string; userId: string; text: string }): string[] {
  return localConversationStore.isSnsStyleEnabled(input) ? splitNaturalTextMessages(input.text) : splitDiscordMessage(input.text);
}
function creditsFromReply(reply: { usage?: GeminiTokenUsage }): number {
  if (!reply.usage) {
    throw new Error('토큰 사용량이 없는 응답입니다. BOT_TEST_DIRECT_GEMINI=true 설정을 확인해 주세요.');
  }
  return creditsForTokens(reply.usage.totalTokens, config.BOT_TOKENS_PER_CREDIT);
}

async function sendCharacterMessage(channel: unknown, text: string): Promise<void> {
  const candidate = channel as { send?: (content: string) => Promise<unknown> } | null;
  if (!candidate || typeof candidate.send !== 'function') {
    throw new Error('This channel cannot receive character messages.');
  }
  await candidate.send(text);
}
async function sendTyping(channel: unknown): Promise<void> {
  const candidate = channel as { sendTyping?: () => Promise<unknown> } | null;
  if (candidate && typeof candidate.sendTyping === 'function') await candidate.sendTyping();
}

async function requireGuild(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) throw new Error('이 명령은 서버 채널에서만 사용할 수 있습니다.');
}

function voiceJoinGreeting(guildId: string, channelId: string, userId: string): string {
  const memories = localConversationStore.listLongMemories({ guildId, channelId, userId });
  const preferredName = memories
    .map((memory) => memory.summary.match(/\b(?:call me|please call me|my name is|my nickname is)\s+([a-z][a-z '-]{0,30})/i)?.[1])
    .find((name): name is string => Boolean(name));
  const name = preferredName?.replace(/\s+/g, ' ').trim();
  return name ? `Hey, ${name}. I'm here.` : `Hey, I'm here. How's your day been?`;
}
async function currentVoiceChannel(interaction: ChatInputCommandInteraction): Promise<VoiceBasedChannel> {
  const guild = interaction.guild;
  if (!guild) throw new Error('??癲ル슢캉???쭍???꿔꺂?????????轅붽틓?????????????욱룏???????낆젵.');
  const member = await guild.members.fetch(interaction.user.id);
  const channel = member.voice.channel;
  if (!channel || !channel.isVoiceBased()) throw new Error('?雅?퍔瑗ⓩ뤃?? ?????????嶺???????ㅳ늾???????용츧????ロ뒌??');
  return channel;
}

class UserFacingError extends Error {}

function creditExhaustedPrompt(userId: string): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  return {
    ...systemMessage('Your credits have been used up. Would you like to upgrade?'),
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${creditUpgradeButtonPrefix}:yes:${userId}`).setLabel('Yes, show plans').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`${creditUpgradeButtonPrefix}:no:${userId}`).setLabel('Not now').setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

async function handleCreditUpgradeButton(interaction: ButtonInteraction): Promise<void> {
  const [, choice, userId] = interaction.customId.split(':');
  if (!userId || interaction.user.id !== userId || (choice !== 'yes' && choice !== 'no')) {
    await interaction.reply({ content: 'This upgrade prompt belongs to another user.', ephemeral: true });
    return;
  }
  if (choice === 'yes') {
    await interaction.update({ ...systemMessage(upgradeInstructions()), components: [] });
    return;
  }
  await interaction.update({ ...systemMessage('No problem. You can upgrade whenever you are ready.'), components: [] });
}

function hasExhaustedCredits(userId: string): boolean {
  return Boolean(testCredits && testCredits.getBalance(userId) === 0);
}
function usageMessage(
  usage: { usedCredits: number; remainingCredits: number; includedCredits: number },
  language: CommandLanguage
): { embeds: EmbedBuilder[] } {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle(commandText(language, 'Usage', '\uC0AC\uC6A9\uB7C9'))
        .setDescription(formatRemainingUsage(usage, language))
    ]
  };
}
function systemMessage(text: string): { embeds: EmbedBuilder[] } {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({ name: 'SYSTEM NOTICE' })
        .setDescription(text)
        .setFooter({ text: 'Service message' })
    ]
  };
}

function upgradeInstructions(): string {
  if (config.BOT_UPGRADE_URL) return `To view plans or upgrade, visit <${config.BOT_UPGRADE_URL}>`;
  return 'Paid plans are not available yet. Please contact the server administrator.';
}

function userFacingError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof CreditExhaustedError) {
    return `You have reached your message limit. ${upgradeInstructions()}`;
  }
  if (isUrgentGeminiFailure(error)) {
    return '??嶺뚮쮳?놂폇??????怨몄뵒??醫딆쓧? ?熬곣뫖利든뜏類ｋ렱???????????딅젩. ??嶺뚮Ĳ?됭짆????援온??잙갭큔??????????戮?뜪?????κ땁??癲ル슢????';
  }
  if (error instanceof BackendApiError) {
    const detail = error.detail.toLowerCase();
    if (error.status === 402 || /billing|payment/.test(detail)) {
      return `A paid plan is required to continue. ${upgradeInstructions()}`;
    }
  }
  return 'I could not complete that request. Please try again shortly.';
}

function reportRequestFailure(context: string, error: unknown): void {
  if (isUrgentGeminiFailure(error)) {
    botLogger.error(`URGENT: Gemini provider failure during ${context}. Administrator action is required.`, error);
    return;
  }
  botLogger.error(`${context} failed`, error);
}

function isUrgentGeminiFailure(error: unknown): boolean {
  if (error instanceof GeminiApiError) return true;
  if (!(error instanceof BackendApiError)) return false;
  const detail = error.detail.toLowerCase();
  return error.status === 503 || error.status === 429 || /high demand|quota|rate limit|resource exhausted/.test(detail);
}
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
