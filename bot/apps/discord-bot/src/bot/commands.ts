import { SlashCommandBuilder } from 'discord.js';

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('선택된 AI 캐릭터에게 메시지를 보냅니다.')
    .addStringOption((option) =>
      option.setName('message').setDescription('보낼 메시지').setRequired(true).setMaxLength(1_500)
    ),
  new SlashCommandBuilder().setName('credit').setDescription('내 테스트 크레딧 잔액을 확인합니다.'),
  new SlashCommandBuilder()
    .setName('character')
    .setDescription('이 채널의 AI 캐릭터를 설정합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('select')
        .setDescription('캐릭터를 선택합니다.')
        .addStringOption((option) =>
          option.setName('id').setDescription('캐릭터 ID').setRequired(true).setMaxLength(80)
        )
    ),
  new SlashCommandBuilder()
    .setName('memory')
    .setDescription('AI 기억 보관 설정을 관리합니다.')
    .addSubcommand((subcommand) => subcommand.setName('on').setDescription('내 기억 보관에 동의합니다.'))
    .addSubcommand((subcommand) => subcommand.setName('off').setDescription('내 기억 보관을 중지합니다.'))
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('내 보관 기억을 확인합니다.'))
    .addSubcommand((subcommand) => subcommand.setName('forget').setDescription('내 보관 기억을 모두 삭제합니다.')),
  new SlashCommandBuilder()
    .setName('voice')
    .setDescription('AI 음성 대화를 관리합니다.')
    .addSubcommand((subcommand) => subcommand.setName('join').setDescription('현재 음성 채널에 AI를 입장시킵니다.'))
    .addSubcommand((subcommand) => subcommand.setName('leave').setDescription('AI를 음성 채널에서 퇴장시킵니다.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('consent')
        .setDescription('현재 음성 채널에서 내 음성의 STT 처리 동의를 설정합니다.')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('동의 여부').setRequired(true)
        )
    )
].map((command) => command.toJSON());
