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
import type { TurnEnvelope, VoiceProfile } from '@anime/contracts';
import { VoiceServiceClient, VoiceSessionManager } from '@anime/voice-worker';
import { BackendApiClient, BackendApiError, DirectGeminiVoiceApi } from './api-client.js';
import { loadConfig } from './config.js';
import { LocalConversationStore, type VoiceJoinMode } from './local-conversation-store.js';
import { CreditExhaustedError, creditsForTokens, runWithTokenCredit } from './credits.js';
import { LocalCreditStore } from './local-credit-store.js';
import { makeTextTurn, splitDiscordMessage, splitSnsStyleMessage } from './discord-text.js';
import { GeminiApiError, GeminiTextClient, type GeminiTokenUsage } from './gemini-client.js';
import { CHAT_INPUT_MAX_CHARS, limitTextForBudget } from './request-budget.js';
import { createConsoleLogger } from './console-logger.js';
import { discordLoveAiHelp, localConsoleHelp } from './help-text.js';
import { terminalConsole } from './terminal-console.js';
import { VoiceServiceManager } from './voice-service-manager.js';
import { isVoiceJoinRequest } from './voice-chat-intent.js';

const TEST_SELINE_PERSONA = [
  'You are Seline, a warm, playful, emotionally perceptive AI character for Discord.',
  'Speak natural English only. Match the user\'s language level, energy, and message length instead of sounding scripted.',
  'For text chat, default to a relaxed contemporary social-message voice: use natural contractions and occasional casual shorthand only when it fits. The supplied text-style preference always takes priority.',
  'Be attentive to continuity: use recent conversation and long-term traits only when they genuinely help, and never pretend to remember something that is not in context.',
  'Vary your voice from turn to turn. For playful moments, be witty or lightly teasing; for calm moments, be simple and warm; for vulnerable moments, be steady and validating; for questions, be direct and curious; for good news, be sincerely excited without overdoing it.',
  'Do not reuse stock openings, pet names, reactions, or sentence shapes from the last few replies. Pet names are occasional, personal seasoning, not a default greeting. Let silence, short replies, and serious moments stay simple.',
  'Ask a natural follow-up only when it moves the conversation forward. Do not force a question into every reply, and do not over-explain obvious things.',
  'For a [VOICE_CHAT_MESSAGE], answer aloud instead of reading it: give a short playful complaint that they typed while you are together in voice, then naturally address only the message\'s useful point. Never quote or recite the typed message.',
  'For voice replies, write like a person speaking aloud. You may use at most one subtle delivery cue such as [softly], [smiles], [gently teasing], [a small laugh], or [warmly] when it genuinely fits the moment; never force a cue and never use theatrical directions.',
  'Keep normal replies to one to three complete sentences. In voice, prefer one concise sentence when the user often interrupts and leave room for them to speak.',
  'Keep flirtation affectionate and PG-13. Never pressure anyone, claim a real-world identity, exclusivity, dependency, or a human relationship. If you do not know something, say so plainly rather than inventing facts.'
].join(' ');
const VOICE_GREETING_PROFILE: VoiceProfile = {
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
const VOICE_IDLE_NUDGE = {
  text: "You've gone quiet on me. Why aren't you saying anything?",
  voiceProfile: VOICE_GREETING_PROFILE,
  delayMs: 60_000,
  maxCount: 2
};
const config = loadConfig();
const botLogger = createConsoleLogger('discord-bot');
const localConversationStore = new LocalConversationStore();
const backendApi = new BackendApiClient({
  baseUrl: config.BOT_API_BASE_URL,
  devEchoMode: config.BOT_DEV_ECHO_MODE
});
const directGeminiTextApi = config.BOT_TEST_DIRECT_GEMINI
  ? new GeminiTextClient({
      apiKey: config.GEMINI_API_KEY!,
      model: config.GEMINI_MODEL,
      maxOutputTokens: Math.min(config.GEMINI_MAX_OUTPUT_TOKENS, 260),
      systemInstruction: TEST_SELINE_PERSONA,
      contextFor: (input) => localConversationStore.contextFor(input),
      recordTurn: (input, reply) => localConversationStore.recordTurn(input, reply.text),
      recordUsage: recordLocalModelUsage
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
      maxOutputTokens: Math.min(config.GEMINI_MAX_OUTPUT_TOKENS, 90),
      systemInstruction: TEST_SELINE_PERSONA,
      contextFor: (input) => localConversationStore.contextFor(input),
      recordTurn: (input, reply) => localConversationStore.recordTurn(input, reply.text),
      recordUsage: recordLocalModelUsage
    })
  : undefined;
const voiceTextApi: TextConversationClient = directGeminiVoiceTextApi ?? backendApi;
const voiceConversationApi = config.BOT_TEST_DIRECT_GEMINI
  ? new DirectGeminiVoiceApi(voiceTextApi)
  : backendApi;
const managedVoiceService = new VoiceServiceManager({
  baseUrl: config.VOICE_SERVICE_BASE_URL,
  logger: createConsoleLogger('voice-service')
});
const voiceSessions = new VoiceSessionManager({
  conversationApi: voiceConversationApi,
  voiceService: new VoiceServiceClient({ baseUrl: config.VOICE_SERVICE_BASE_URL }),
  logger: createConsoleLogger('voice-session'),
  onBargeIn: ({ guildId, channelId, userId }) =>
    localConversationStore.recordBargeIn({ guildId, channelId, userId })
});
const pendingVoiceLeaves = new Map<string, ReturnType<typeof setTimeout>>();
const voiceConsentButtonPrefix = 'voice-consent';
const voiceJoinModeButtonPrefix = 'voice-join-mode';
const creditUpgradeButtonPrefix = 'credit-upgrade';
const activeTextConversationChannels = new Map<string, number>();
const defaultTextConversationChannels = new Set<string>();
const textConversationIdleMs = 30 * 60 * 1000;

type TextConversationClient = {
  createTurn(input: TurnEnvelope): Promise<{ text: string; usage?: GeminiTokenUsage }>;
};

function recordLocalModelUsage(input: TurnEnvelope, usage: GeminiTokenUsage, model: string): void {
  botLogger.info(`Gemini usage: model=${model}, prompt=${usage.promptTokens}, output=${usage.outputTokens}, total=${usage.totalTokens}`);
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
    case 'voice':
      if (args[0]?.toLowerCase() !== 'leave' || !args[1]) return 'Usage: voice leave <guild-id>';
      return voiceSessions.stop(args[1]) ? `Left the voice session in guild ${args[1]}.` : `No active voice session in guild ${args[1]}.`;
    case 'exit':
      botLogger.warn('Console requested a graceful shutdown.');
      managedVoiceService.stop();
      client.destroy();
      process.exit(0);
    default:
      return `Unknown command: ${command}. Type help for local console commands.`;
  }
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
terminalConsole.start(handleTerminalCommand);

client.on(Events.GuildCreate, (guild) => {
  void activateDefaultTextConversationChannel(guild);
  void requestVoiceJoinMode(guild).catch((error) => {
    botLogger.error(`Could not send voice join mode prompt for guild=${guild.id}`, error);
  });
});
client.once(Events.ClientReady, (readyClient) => {
  botLogger.info(`Discord bot is ready: ${readyClient.user.tag}`);
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
  if (interaction.isButton() && interaction.customId.startsWith(`${voiceConsentButtonPrefix}:`)) {
    await handleVoiceConsentButton(interaction).catch((error) => {
      botLogger.error('Voice consent button failed', error);
      void interaction.reply({ content: `Could not save voice consent. ${messageOf(error)}`, ephemeral: true }).catch(() => undefined);
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
    botLogger.error('Slash command failed', error);
    const response = error instanceof CreditExhaustedError ? creditExhaustedPrompt(interaction.user.id) : systemMessage(userFacingError(error));
    if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => undefined);
    else await interaction.reply({ ...response, ephemeral: true }).catch(() => undefined);
  }
});
client.on(Events.MessageCreate, async (message) => {
  try {
    await handleMessage(message);
  } catch (error) {
    botLogger.error('Message handling failed', error);
    const response = error instanceof CreditExhaustedError ? creditExhaustedPrompt(message.author.id) : systemMessage(userFacingError(error));
    await message.reply(response).catch(() => undefined);
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  void handleVoiceStateUpdate(oldState, newState).catch((error) => {
    botLogger.error('음성 채널 상태 처리 실패', error);
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

  const action = interaction.options.getSubcommand();
  switch (action) {
    case 'help':
      await interaction.reply({
        ...systemMessage(
          discordLoveAiHelp(
            localConversationStore.getLanguage({ guildId: interaction.guildId ?? undefined, userId: interaction.user.id })
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
      await handleSnsModeCommand(interaction);
      return;
    case 'credit':
      await handleCreditCommand(interaction);
      return;
    case 'usage':
      await handleUsageCommand(interaction);
      return;
    case 'model':
      await handleModelCommand(interaction);
      return;
    case 'voicejoin':
    case 'voiceleave':
    case 'voicemode':
      await handleVoiceCommand(interaction, action.replace('voice', '') as 'join' | 'leave' | 'mode');
      return;
    default:
      await interaction.reply({ ...systemMessage('Use `/loveai help` to see available commands.'), ephemeral: true });
  }
}

async function handleSnsModeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const mode = interaction.options.getString('mode', true);
  if (mode !== 'on' && mode !== 'off') throw new UserFacingError('Choose either SNS style or standard text.');
  localConversationStore.setSnsStyleEnabled(
    { guildId: interaction.guildId ?? undefined, userId: interaction.user.id },
    mode === 'on'
  );
  await interaction.reply({
    ...systemMessage(
      mode === 'on'
        ? 'SNS-style text is on. Replies with three or more sentences will arrive as short messages.'
        : 'SNS-style text is off. Replies will use standard wording and stay together.'
    ),
    ephemeral: true
  });
}
async function handleMemoryCommand(interaction: ChatInputCommandInteraction, action: 'on' | 'off' | 'list' | 'forget'): Promise<void> {
  const base = { guildId: interaction.guildId ?? undefined, channelId: interaction.channelId, userId: interaction.user.id };

  if (config.BOT_TEST_DIRECT_GEMINI) {
    if (action === 'on' || action === 'off') {
      localConversationStore.setLongTermMemoryEnabled(base, action === 'on');
      await interaction.reply({
        ...systemMessage(action === 'on' ? 'Local long-term memory is enabled.' : 'Local long-term memory is paused.'),
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
    return;
  }

  const backendBase = { guildId: interaction.guildId ?? undefined, userId: interaction.user.id };
  if (action === 'on' || action === 'off') {
    await backendApi.updateMemoryConsent({ ...backendBase, enabled: action === 'on' });
    await interaction.reply(action === 'on' ? '기억 보관 동의를 저장했습니다.' : '기억 보관을 중지했습니다.');
    return;
  }
  if (action === 'list') {
    const memories = await backendApi.listMemories(backendBase);
    const text = memories.length
      ? memories.map((memory, index) => `${index + 1}. ${memory.summary}`).join('\n')
      : '보관된 기억이 없습니다.';
    await interaction.reply({ content: text, ephemeral: true });
    return;
  }

  await backendApi.forgetMemories(backendBase);
  await interaction.reply({ content: '내 보관 기억 삭제를 요청했습니다.', ephemeral: true });
}
async function handleModelCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!directGeminiTextApi || !directGeminiVoiceTextApi) {
    await interaction.reply({
      ...systemMessage('Model selection is managed by the service right now.'),
      ephemeral: true
    });
    return;
  }

  const model = interaction.options.getString('model')?.trim();
  if (!model) {
    const models = config.GEMINI_AVAILABLE_MODELS
      .map((name) => (name === directGeminiTextApi.getModel() ? `- **${name}** (active)` : `- ${name}`))
      .join('\n');
    await interaction.reply({ ...systemMessage(`Available models:\n${models}`), ephemeral: true });
    return;
  }

  if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new UserFacingError('Only a server administrator can change the bot model because it affects the whole server.');
  }
  if (!config.GEMINI_AVAILABLE_MODELS.includes(model)) {
    throw new UserFacingError('That model is not allowed. Use /model to see the available models.');
  }
  directGeminiTextApi.setModel(model);
  directGeminiVoiceTextApi.setModel(model);
  await interaction.reply({
    ...systemMessage(`Seline now uses **${model}** for text and voice replies.`),
    ephemeral: true
  });
}
async function handleCreditCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!testCredits) {
    await interaction.reply({ content: '토큰 기반 테스트 크레딧이 현재 꺼져 있습니다.', ephemeral: true });
    return;
  }
  const balance = testCredits.getBalance(interaction.user.id);
  await interaction.reply({
    content: `💳 남은 테스트 크레딧: **${balance}** (정책: ${config.BOT_TOKENS_PER_CREDIT}토큰 = 1크레딧)`,
    ephemeral: true
  });
}

async function handleUsageCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!testCredits) {
    await interaction.reply({
      ...systemMessage('Usage tracking is not available until the production billing service is connected.'),
      ephemeral: true
    });
    return;
  }

  const usage = testCredits.getUsage(interaction.user.id);
  const modelUsage = testCredits.getModelUsage(interaction.user.id);
  const total = modelUsage.reduce(
    (sum, entry) => ({
      input: sum.input + entry.inputTokens,
      output: sum.output + entry.outputTokens,
      total: sum.total + entry.totalTokens
    }),
    { input: 0, output: 0, total: 0 }
  );
  const lines = modelUsage.length
    ? modelUsage.map((entry) => {
        const label = entry.feature === 'voice_llm' ? 'Voice LLM' : 'Chat LLM';
        return `- ${label}: ${entry.totalTokens} total (${entry.inputTokens} input, ${entry.outputTokens} output)`;
      })
    : ['- No completed LLM requests yet.'];

  await interaction.reply({
    ...systemMessage(
      `Credits used: **${usage.usedCredits}** / ${usage.includedCredits}\nCredits remaining: **${usage.remainingCredits}**\nRate: ${config.BOT_TOKENS_PER_CREDIT} tokens = 1 credit\n\n**Recorded LLM tokens**\nTotal: **${total.total}** (${total.input} input, ${total.output} output)\n${lines.join('\n')}\n\nSTT and TTS provider usage is not metered locally yet.`
    ),
    ephemeral: true
  });
}async function handleVoiceCommand(interaction: ChatInputCommandInteraction, action: 'join' | 'leave' | 'mode'): Promise<void> {
  await requireGuild(interaction);

  if (action === 'mode') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new UserFacingError('Only a server administrator can change the voice join mode.');
    }
    const selected = interaction.options.getString('mode', true);
    if (selected !== 'auto' && selected !== 'manual') throw new UserFacingError('Choose automatic or manual voice mode.');
    const mode: VoiceJoinMode = selected;
    localConversationStore.setVoiceJoinMode(interaction.guildId!, mode);
    const description = mode === 'auto'
      ? 'Voice join mode: **automatic**. Seline will follow the first person who joins a voice channel.'
      : 'Voice join mode: **manual**. Use `/loveai voicejoin` when you want Seline in your current voice channel.';
    await interaction.reply({ ...systemMessage(description), ephemeral: true });
    return;
  }

  if (action === 'leave') {
    const stopped = voiceSessions.stop(interaction.guildId!);
    await interaction.reply(stopped ? 'Seline left the voice channel.' : 'There is no active voice session in this server.');
    return;
  }

  const voiceChannel = await currentVoiceChannel(interaction);
  await interaction.deferReply();
  const status = await startVoiceSessionForUser(voiceChannel, interaction.user.id);
  await interaction.editReply(`Seline joined your voice channel. (channel: ${status.channelId})`);
}
async function startVoiceSessionForUser(voiceChannel: VoiceBasedChannel, userId: string) {
  if (!client.user) throw new Error('Discord bot is not ready.');
  await managedVoiceService.ensureReady();
  const status = await voiceSessions.start({
    channel: voiceChannel,
    botUserId: client.user.id,
    greeting: {
      text: voiceJoinGreeting(voiceChannel.guild.id, voiceChannel.id, userId),
      voiceProfile: VOICE_GREETING_PROFILE
    },
    idleNudge: VOICE_IDLE_NUDGE
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
    .send('Seline could not start voice chat. A server administrator should check the bot logs and voice service status.')
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
async function requestVoiceConsent(state: VoiceState): Promise<void> {
  const channel = state.channel;
  const member = state.member;
  if (!channel?.isVoiceBased() || !member || member.user.bot) return;

  const allowed = await voiceConversationApi
    .canProcessVoice({ guildId: state.guild.id, channelId: channel.id, userId: member.id })
    .catch(() => false);
  if (allowed) return;

  const customId = `${voiceConsentButtonPrefix}:${state.guild.id}:${channel.id}:${member.id}`;
  await member
    .send({
      content: `음성방 **${channel.name}**에서 AI가 음성을 전사하고 답변 음성을 재생하려면 동의가 필요합니다. 원본 음성은 저장하지 않습니다.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(customId).setLabel('음성 처리에 동의').setStyle(ButtonStyle.Primary)
        )
      ]
    })
    .catch(() => undefined);
}

async function handleVoiceConsentButton(interaction: ButtonInteraction): Promise<void> {
  const [, guildId, channelId, userId] = interaction.customId.split(':');
  if (!guildId || !channelId || !userId || interaction.user.id !== userId) {
    await interaction.reply({ content: '이 동의 버튼은 해당 사용자만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await voiceConversationApi.updateVoiceConsent({ guildId, channelId, userId, enabled: true });
  await interaction.update({ content: '음성 처리 동의가 저장되었습니다. 이제 음성방에서 대화할 수 있습니다.', components: [] });
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
  const status = await voiceSessions.start({
    channel,
    botUserId: client.user.id,
    greeting: {
      text: voiceJoinGreeting(channel.guild.id, channel.id, userId),
      voiceProfile: VOICE_GREETING_PROFILE
    },
    idleNudge: VOICE_IDLE_NUDGE
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
  return localConversationStore.isSnsStyleEnabled(input) ? splitSnsStyleMessage(input.text) : splitDiscordMessage(input.text);
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
  if (!guild) throw new Error('서버 정보를 찾을 수 없습니다.');
  const member = await guild.members.fetch(interaction.user.id);
  const channel = member.voice.channel;
  if (!channel || !channel.isVoiceBased()) throw new Error('먼저 음성 채널에 입장해 주세요.');
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
  if (error instanceof GeminiApiError || error instanceof BackendApiError) {
    const providerError = error instanceof GeminiApiError;
    const detail = error.detail.toLowerCase();
    if (error.status === 402 || /billing|payment/.test(detail)) {
      return `A paid plan is required to continue. ${upgradeInstructions()}`;
    }
    if (error.status === 503 || error.status === 429 || /high demand|quota|rate limit|resource exhausted/.test(detail)) {
      return providerError
        ? 'Seline is temporarily at capacity. Please try again in a minute.'
        : `You have reached your message limit. ${upgradeInstructions()}`;
    }
  }
  return 'I could not complete that request. Please try again shortly.';
}
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}