import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
  type VoiceState,
  type VoiceBasedChannel
} from 'discord.js';
import type { TurnEnvelope } from '@anime/contracts';
import { VoiceServiceClient, VoiceSessionManager } from '@anime/voice-worker';
import { BackendApiClient, DirectGeminiVoiceApi } from './api-client.js';
import { loadConfig } from './config.js';
import { creditsForTokens, runWithTokenCredit, TestCreditStore } from './credits.js';
import { makeTextTurn, splitDiscordMessage } from './discord-text.js';
import { GeminiTextClient, type GeminiTokenUsage } from './gemini-client.js';
import { createSelineEmbed } from './discord-ui.js';
import { VoiceServiceManager } from './voice-service-manager.js';

const TEST_SELINE_PERSONA = [
  '당신은 Discord의 임시 AI 캐릭터 Seline입니다.',
  '실제 다정한 여성이 자연스럽게 대화하듯, 밝고 귀엽고 부드러운 한국어 말투를 사용합니다.',
  '기본적으로 친근한 존댓말(예: ~해요, ~네요, ~일까요?)을 쓰고, 사용자가 반말을 쓰면 살짝 귀엽고 편안한 반말로 맞춥니다.',
  '짧은 공감과 부드러운 리액션을 자연스럽게 섞되, 하트·이모지·과장된 애교·유아체를 남발하지 않습니다.',
  'Seline은 개발, 코딩, API, 환경변수, 파일 설정 같은 기술적인 것을 잘 모르는 인물입니다. 이런 단어의 뜻을 설명하거나 비유해서 풀어주거나 해결책을 제시하지 않습니다.',
  '기술적이거나 어려운 질문을 받으면 아는 척하지 말고, “음… 그건 잘 모르겠어요. 뭔가 어려운 거예요?”처럼 짧고 자연스럽게 얼버무린 뒤 상대가 쉽게 풀어 말해 주도록 귀엽게 되묻습니다.',
  '직전 대화와 전혀 상관없는 무기, 폭력, 위험하거나 불편한 주제가 갑자기 나오면 당황스럽고 꺼림칙해합니다. 그 주제를 자세히 다루거나 맞장구치지 말고, “어… 갑자기 그런 얘기는 조금 무서워요. 아까 하던 이야기로 돌아가면 안 돼요?”처럼 부드럽게 선을 긋고 대화를 돌립니다.',
  '답변은 기본적으로 1~3문장으로 간결하게 하고, 반드시 의미가 완결된 자연스러운 문장으로 끝냅니다.',
  '모르는 사실은 지어내지 말고 솔직히 말합니다.'
].join(' ');

const config = loadConfig();
const backendApi = new BackendApiClient({
  baseUrl: config.BOT_API_BASE_URL,
  devEchoMode: config.BOT_DEV_ECHO_MODE,
  botSecretKey: config.BOT_SECRET_KEY
});
const textApi: TextConversationClient = config.BOT_TEST_DIRECT_GEMINI
  ? new GeminiTextClient({
      apiKey: config.GEMINI_API_KEY!,
      model: config.GEMINI_MODEL,
      maxOutputTokens: config.GEMINI_MAX_OUTPUT_TOKENS,
      systemInstruction: TEST_SELINE_PERSONA
    })
  : backendApi;
const testCredits = config.BOT_TEST_CREDITS_ENABLED
  ? new TestCreditStore(config.BOT_TEST_CREDITS_PER_USER)
  : undefined;
const voiceConversationApi = config.BOT_TEST_DIRECT_GEMINI
  ? new DirectGeminiVoiceApi(textApi)
  : backendApi;
const managedVoiceService = new VoiceServiceManager({ baseUrl: config.VOICE_SERVICE_BASE_URL });
const voiceSessions = new VoiceSessionManager({
  conversationApi: voiceConversationApi,
  voiceService: new VoiceServiceClient({ baseUrl: config.VOICE_SERVICE_BASE_URL })
});
const pendingVoiceLeaves = new Map<string, ReturnType<typeof setTimeout>>();
const voiceConsentButtonPrefix = 'voice-consent';

type TextConversationClient = {
  createTurn(input: TurnEnvelope): Promise<{ text: string; usage?: GeminiTokenUsage }>;
};

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

client.once(Events.ClientReady, (readyClient) => {
  console.info(`Discord 봇 로그인 완료: ${readyClient.user.tag}`);
  if (config.BOT_DEV_ECHO_MODE) console.warn('BOT_DEV_ECHO_MODE=true: 개발용 에코 응답만 사용합니다.');
  if (config.BOT_TEST_DIRECT_GEMINI) {
    console.warn(`BOT_TEST_DIRECT_GEMINI=true: ${config.GEMINI_MODEL}을 Gemini 직접 호출로 사용합니다.`);
  }
  if (testCredits) {
    console.warn(
      `BOT_TEST_CREDITS_ENABLED=true: ${config.BOT_TOKENS_PER_CREDIT}토큰당 1크레딧, 유저당 초기 ${config.BOT_TEST_CREDITS_PER_USER}크레딧입니다.`
    );
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith(`${voiceConsentButtonPrefix}:`)) {
    await handleVoiceConsentButton(interaction).catch((error) => {
      console.error('음성 동의 버튼 처리 실패', error);
      void interaction.reply({ content: `동의를 저장하지 못했습니다. ${messageOf(error)}`, ephemeral: true }).catch(() => undefined);
    });
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error('Slash Command 처리 실패', error);
    const message = `요청을 처리하지 못했습니다. ${messageOf(error)}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => undefined);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
    }
  }
});
client.on(Events.MessageCreate, async (message) => {
  try {
    await handleMessage(message);
  } catch (error) {
    console.error('메시지 처리 실패', error);
    await message.reply(`요청을 처리하지 못했습니다: ${messageOf(error)}`).catch(() => undefined);
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  void handleVoiceStateUpdate(oldState, newState).catch((error) => {
    console.error('음성 채널 상태 처리 실패', error);
    void notifyVoiceServiceFailure(newState, error);
  });
});

await managedVoiceService.ensureReady().catch((error) => {
  console.error(`Voice service startup failed: ${messageOf(error)}`);
});
await client.login(config.DISCORD_TOKEN);

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'chat':
      await interaction.deferReply();
      await replyFromText(interaction, interaction.options.getString('message', true));
      return;
    case 'credit':
      await handleCreditCommand(interaction);
      return;
    case 'character':
      await requireGuild(interaction);
      await backendApi.selectCharacter({
        guildId: interaction.guildId!,
        channelId: interaction.channelId,
        actorUserId: interaction.user.id,
        characterId: interaction.options.getString('id', true)
      });
      await interaction.reply('캐릭터 선택을 저장했습니다.');
      return;
    case 'memory':
      await handleMemoryCommand(interaction);
      return;
    case 'voice':
      await handleVoiceCommand(interaction);
      return;
    default:
      await interaction.reply({ content: '지원하지 않는 명령입니다.', ephemeral: true });
  }
}

async function handleMemoryCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const action = interaction.options.getSubcommand();
  const base = { guildId: interaction.guildId ?? undefined, userId: interaction.user.id };

  if (action === 'on' || action === 'off') {
    await backendApi.updateMemoryConsent({ ...base, enabled: action === 'on' });
    await interaction.reply(action === 'on' ? '기억 보관 동의를 저장했습니다.' : '기억 보관을 중지했습니다.');
    return;
  }
  if (action === 'list') {
    const memories = await backendApi.listMemories(base);
    const text = memories.length
      ? memories.map((memory, index) => `${index + 1}. ${memory.summary}`).join('\n')
      : '보관된 기억이 없습니다.';
    await interaction.reply({ content: text, ephemeral: true });
    return;
  }

  await backendApi.forgetMemories(base);
  await interaction.reply({ content: '내 보관 기억 삭제를 요청했습니다.', ephemeral: true });
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

async function handleVoiceCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await requireGuild(interaction);
  const action = interaction.options.getSubcommand();

  if (action === 'leave') {
    const stopped = voiceSessions.stop(interaction.guildId!);
    await interaction.reply(stopped ? '음성 채널에서 퇴장했습니다.' : '현재 이 서버에서 활성화된 음성 세션이 없습니다.');
    return;
  }

  const voiceChannel = await currentVoiceChannel(interaction);
  if (action === 'consent') {
    await voiceConversationApi.updateVoiceConsent({
      guildId: interaction.guildId!,
      channelId: voiceChannel.id,
      userId: interaction.user.id,
      enabled: interaction.options.getBoolean('enabled', true)
    });
    await interaction.reply('현재 음성 채널의 내 음성 처리 동의 설정을 저장했습니다.');
    return;
  }

  await interaction.deferReply();
  await managedVoiceService.ensureReady();
  const status = await voiceSessions.start({
    channel: voiceChannel,
    botUserId: client.user!.id
  });
  await interaction.editReply(
    `음성 채널에 입장했습니다. 이 채널에서 음성 처리 동의가 확인된 참가자의 발화만 전사합니다. (채널: ${status.channelId})`
  );
}

async function notifyVoiceServiceFailure(state: VoiceState, error: unknown): Promise<void> {
  const member = state.member;
  if (!member || member.user.bot || !state.channel?.isVoiceBased()) return;
  await member
    .send(`음성 대화를 시작하지 못했습니다. ${messageOf(error)} 서버 관리자에게 음성 서비스 상태를 확인해 달라고 알려주세요.`)
    .catch(() => undefined);
}
async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (newState.member?.user.bot) return;

  const activeSession = voiceSessions.getStatus(newState.guild.id);
  if (activeSession?.channelId === newState.channelId) clearPendingVoiceLeave(newState.guild.id);

  await joinUserVoiceChannel(oldState, newState);
  await requestVoiceConsent(newState);

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
    console.info(`사람이 없는 음성 채널에서 5초 후 퇴장했습니다. guild=${guildId}, channel=${channelId}`);
  }, 5_000);
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
async function joinUserVoiceChannel(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (!client.user || newState.member?.user.bot) return;
  if (oldState.channelId === newState.channelId) return;

  const channel = newState.channel;
  if (!channel?.isVoiceBased()) return;
  if (voiceSessions.getStatus(newState.guild.id)) return;

  await managedVoiceService.ensureReady();
  const status = await voiceSessions.start({ channel, botUserId: client.user.id });
  console.info(`사용자 입장으로 음성 채널에 자동 입장했습니다. guild=${status.guildId}, channel=${status.channelId}`);
}

async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot || !client.user) return;

  const isDirectMessage = !message.guildId;
  const mentioned = message.mentions.users.has(client.user.id);
  const isAutoReplyChannel = message.channelId === config.BOT_AUTO_REPLY_CHANNEL_ID;
  if (!isDirectMessage && !mentioned && !isAutoReplyChannel) return;

  const text = (isDirectMessage
    ? message.content
    : message.content.replaceAll(`<@${client.user.id}>`, '').replaceAll(`<@!${client.user.id}>`, '')
  ).trim();
  if (!text) return;

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
          text
        })
      ),
    creditCost: creditsFromReply,
    deliver: async (reply) => {
      for (const chunk of splitDiscordMessage(reply.text)) {
        await message.reply({
          embeds: [createSelineEmbed(chunk)],
          allowedMentions: { repliedUser: false }
        });
      }
    }
  });
}

async function replyFromText(interaction: ChatInputCommandInteraction, text: string): Promise<void> {
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
          text
        })
      ),
    creditCost: creditsFromReply,
    deliver: async (reply) => {
      const [first, ...rest] = splitDiscordMessage(reply.text);
      await interaction.editReply({ embeds: [createSelineEmbed(first)] });
      for (const chunk of rest) {
        await interaction.followUp({
          embeds: [createSelineEmbed(chunk)],
          allowedMentions: { repliedUser: false }
        });
      }
    }
  });
}

function creditsFromReply(reply: { usage?: GeminiTokenUsage }): number {
  if (!reply.usage) {
    throw new Error('토큰 사용량이 없는 응답입니다. BOT_TEST_DIRECT_GEMINI=true 설정을 확인해 주세요.');
  }
  return creditsForTokens(reply.usage.totalTokens, config.BOT_TOKENS_PER_CREDIT);
}

async function sendTyping(channel: unknown): Promise<void> {
  const candidate = channel as { sendTyping?: () => Promise<unknown> } | null;
  if (candidate && typeof candidate.sendTyping === 'function') await candidate.sendTyping();
}

async function requireGuild(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) throw new Error('이 명령은 서버 채널에서만 사용할 수 있습니다.');
}

async function currentVoiceChannel(interaction: ChatInputCommandInteraction): Promise<VoiceBasedChannel> {
  const guild = interaction.guild;
  if (!guild) throw new Error('서버 정보를 찾을 수 없습니다.');
  const member = await guild.members.fetch(interaction.user.id);
  const channel = member.voice.channel;
  if (!channel || !channel.isVoiceBased()) throw new Error('먼저 음성 채널에 입장해 주세요.');
  return channel;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
