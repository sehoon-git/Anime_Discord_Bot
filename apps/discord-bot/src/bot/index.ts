import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type ChatInputCommandInteraction,
  type Message,
  type VoiceBasedChannel
} from 'discord.js';
import type { TurnEnvelope } from '@anime/contracts';
import { VoiceServiceClient, VoiceSessionManager } from '@anime/voice-worker';
import { BackendApiClient } from './api-client.js';
import { loadConfig } from './config.js';
import { creditsForTokens, runWithTokenCredit, TestCreditStore } from './credits.js';
import { makeTextTurn, splitDiscordMessage } from './discord-text.js';
import { GeminiTextClient, type GeminiTokenUsage } from './gemini-client.js';

const config = loadConfig();
const backendApi = new BackendApiClient({
  baseUrl: config.BOT_API_BASE_URL,
  devEchoMode: config.BOT_DEV_ECHO_MODE
});
const textApi: TextConversationClient = config.BOT_TEST_DIRECT_GEMINI
  ? new GeminiTextClient({
      apiKey: config.GEMINI_API_KEY!,
      model: config.GEMINI_MODEL,
      maxOutputTokens: config.GEMINI_MAX_OUTPUT_TOKENS
    })
  : backendApi;
const testCredits = config.BOT_TEST_CREDITS_ENABLED
  ? new TestCreditStore(config.BOT_TEST_CREDITS_PER_USER)
  : undefined;
const voiceSessions = new VoiceSessionManager({
  conversationApi: backendApi,
  voiceService: new VoiceServiceClient({ baseUrl: config.VOICE_SERVICE_BASE_URL })
});

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
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error('Slash Command 처리 실패', error);
    const message = `요청을 처리하지 못했습니다: ${messageOf(error)}`;
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
    await backendApi.updateVoiceConsent({
      guildId: interaction.guildId!,
      channelId: voiceChannel.id,
      userId: interaction.user.id,
      enabled: interaction.options.getBoolean('enabled', true)
    });
    await interaction.reply('현재 음성 채널의 내 음성 처리 동의 설정을 저장했습니다.');
    return;
  }

  await interaction.deferReply();
  const status = await voiceSessions.start({
    channel: voiceChannel,
    botUserId: client.user!.id
  });
  await interaction.editReply(
    `음성 채널에 입장했습니다. 이 채널에서 음성 처리 동의가 확인된 참가자의 발화만 전사합니다. (채널: ${status.channelId})`
  );
}

async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot || !client.user) return;

  const isDirectMessage = !message.guildId;
  const mentioned = message.mentions.users.has(client.user.id);
  if (!isDirectMessage && !mentioned) return;

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
      for (const chunk of splitDiscordMessage(reply.text)) await message.reply(chunk);
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
      await interaction.editReply(first);
      for (const chunk of rest) await interaction.followUp(chunk);
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