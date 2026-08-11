import { SlashCommandBuilder } from 'discord.js';

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('loveai')
    .setDescription('Seline and LoveAI controls.')
    .setDescriptionLocalizations({ ko: '셀린과 LoveAI를 제어합니다.' })
    .addSubcommand((subcommand) => subcommand.setName('help').setDescription('Show LoveAI command help.').setDescriptionLocalizations({ ko: 'LoveAI 명령어 도움말을 봅니다.' }))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('chat')
        .setDescription('Send a text message to Seline.')
        .setDescriptionLocalizations({ ko: '셀린에게 텍스트 메시지를 보냅니다.' })
        .addStringOption((option) => option.setName('message').setDescription('Message to send.').setDescriptionLocalizations({ ko: '보낼 메시지입니다.' }).setRequired(true).setMaxLength(1_500))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('snsmode')
        .setDescription('Choose relaxed SNS-style text replies or standard text replies.')
        .setDescriptionLocalizations({ ko: 'SNS 스타일 또는 기본 텍스트 답변을 선택합니다.' })
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Your text reply style.')
            .setDescriptionLocalizations({ ko: '텍스트 답변 스타일입니다.' })
            .setRequired(true)
            .addChoices(
              { name: 'SNS style (default)', name_localizations: { ko: 'SNS 스타일 (기본)' }, value: 'on' },
              { name: 'Standard text', name_localizations: { ko: '기본 텍스트' }, value: 'off' }
            )
        )
    )
    .addSubcommand((subcommand) => subcommand.setName('credit').setDescription('Show your development credit balance.').setDescriptionLocalizations({ ko: '개발용 크레딧 잔액을 봅니다.' }))
    .addSubcommand((subcommand) => subcommand.setName('usage').setDescription('Show your remaining usage percentage.').setDescriptionLocalizations({ ko: '남은 사용량 퍼센트를 봅니다.' }))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('model')
        .setDescription('Show available models or switch the server model.')
        .setDescriptionLocalizations({ ko: '사용 가능한 모델을 보거나 서버 모델을 바꿉니다.' })
        .addStringOption((option) => option.setName('model').setDescription('Allowed Gemini model name.').setDescriptionLocalizations({ ko: '허용된 Gemini 모델 이름입니다.' }).setRequired(false))
    )
    .addSubcommand((subcommand) => subcommand.setName('voicejoin').setDescription('Make Seline join your current voice channel.').setDescriptionLocalizations({ ko: '셀린을 현재 음성 채널에 참여시킵니다.' }))
    .addSubcommand((subcommand) => subcommand.setName('voiceleave').setDescription('Make Seline leave the voice channel.').setDescriptionLocalizations({ ko: '셀린을 음성 채널에서 나가게 합니다.' }))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('voicemode')
        .setDescription('Choose automatic follow or manual voice joining.')
        .setDescriptionLocalizations({ ko: '자동 또는 수동 음성 참여를 선택합니다.' })
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Voice join behavior for this server.')
            .setDescriptionLocalizations({ ko: '이 서버의 음성 참여 방식입니다.' })
            .setRequired(true)
            .addChoices(
              { name: 'Automatic follow', name_localizations: { ko: '자동 따라가기' }, value: 'auto' },
              { name: 'Manual (/loveai voicejoin)', name_localizations: { ko: '수동 (/loveai voicejoin)' }, value: 'manual' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('language')
        .setDescription('Choose the speech-recognition language for your current voice channel.')
        .setDescriptionLocalizations({ ko: '현재 음성 채널의 음성 인식 언어를 선택합니다.' })
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Language to recognize in voice chat.')
            .setDescriptionLocalizations({ ko: '음성 채팅에서 인식할 언어입니다.' })
            .setRequired(true)
            .addChoices(
              { name: 'Automatic detection (recommended)', name_localizations: { ko: '자동 감지 (권장)' }, value: 'auto' },
              { name: 'English', name_localizations: { ko: '영어' }, value: 'en' },
              { name: 'Korean', name_localizations: { ko: '한국어' }, value: 'ko' }
            )
        )
    )
].map((command) => command.toJSON());
