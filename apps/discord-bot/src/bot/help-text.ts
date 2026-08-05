export type HelpLanguage = 'en-US' | 'ko';

/** Commands available only to the person running the bot process. */
export function localConsoleHelp(): string[] {
  return [
    '로컬 콘솔 명령어',
    'help - 이 콘솔에서 사용할 수 있는 명령어와 설명을 표시합니다.',
    'status - Discord 봇의 연결 상태를 확인합니다.',
    'status <서버 ID> - Discord 연결 상태와 해당 서버의 음성 세션 상태를 확인합니다.',
    'voice leave <서버 ID> - 해당 서버에서 진행 중인 셀린의 음성 세션을 종료합니다.',
    'clear - 콘솔에 표시된 로그를 지웁니다.',
    'exit - 봇과 음성 처리 서비스를 안전하게 종료합니다.'
  ];
}

/** Help shown inside Discord; it never documents process-local commands. */
export function discordLoveAiHelp(language: HelpLanguage): string {
  return language === 'ko' ? koreanDiscordHelp() : englishDiscordHelp();
}

function englishDiscordHelp(): string {
  return [
    '**LoveAI help**',
    'Talk naturally by mentioning Seline in a text channel, or use `/loveai chat` to start a message.',
    '',
    '**Chat**',
    '`/loveai chat message:<text>` — Send Seline a text message.',
    '`/loveai snsmode mode:on` — Receive longer replies as a few short, casual messages.',
    '`/loveai snsmode mode:off` — Receive each reply as one standard message.',
    '',
    '**Account and model**',
    '`/loveai usage` — View this month\'s token usage and your remaining credits.',
    '`/loveai credit` — View your current development-credit balance.',
    '`/loveai model` — View available AI models for this server.',
    '`/loveai model model:<name>` — Change this server\'s AI model.',
    '',
    '**Voice**',
    '`/loveai voicejoin` — Bring Seline into the voice channel you are currently in.',
    '`/loveai voiceleave` — Ask Seline to leave the active voice channel.',
    '`/loveai voicemode mode:auto` — Have Seline follow members into voice channels automatically.',
    '`/loveai voicemode mode:manual` — Let Seline join only when someone uses `/loveai voicejoin`.'
  ].join('\n');
}

function koreanDiscordHelp(): string {
  return [
    '**LoveAI 도움말**',
    '텍스트 채널에서 셀린을 멘션해 자연스럽게 대화하거나, `/loveai chat`으로 메시지를 보낼 수 있습니다.',
    '',
    '**채팅**',
    '`/loveai chat message:<내용>` — 셀린에게 텍스트 메시지를 보냅니다.',
    '`/loveai snsmode mode:on` — 긴 답변을 짧고 편한 여러 메시지로 받습니다.',
    '`/loveai snsmode mode:off` — 답변을 일반적인 한 개의 메시지로 받습니다.',
    '',
    '**사용량 및 모델**',
    '`/loveai usage` — 이번 달 토큰 사용량과 남은 크레딧을 확인합니다.',
    '`/loveai credit` — 현재 개발용 크레딧 잔액을 확인합니다.',
    '`/loveai model` — 이 서버에서 선택할 수 있는 AI 모델을 확인합니다.',
    '`/loveai model model:<이름>` — 이 서버에서 사용할 AI 모델을 변경합니다.',
    '',
    '**음성 채팅**',
    '`/loveai voicejoin` — 셀린을 현재 내가 있는 음성 채널에 참여시킵니다.',
    '`/loveai voiceleave` — 셀린을 현재 음성 채널에서 나가게 합니다.',
    '`/loveai voicemode mode:auto` — 사용자가 음성 채널에 들어가면 셀린이 자동으로 따라오게 합니다.',
    '`/loveai voicemode mode:manual` — 누군가 `/loveai voicejoin`을 사용할 때만 셀린이 음성 채널에 참여하게 합니다.'
  ].join('\n');
}
