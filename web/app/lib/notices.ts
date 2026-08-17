export type NoticeCategory = "notice" | "event" | "update";

export type Notice = {
  slug: string;
  category: NoticeCategory;
  publishedAt: string;
  title: { ko: string; en: string; ja: string };
  summary: { ko: string; en: string; ja: string };
  content: { ko: string[]; en: string[]; ja: string[] };
};

// 운영 공지·이벤트는 이 목록에 추가하면 공지 목록과 상세 페이지에 자동으로 표시됩니다.
export const notices: Notice[] = [
  {
    slug: "welcome-to-voice-with-ai",
    category: "notice",
    publishedAt: "2026-08-17",
    title: { ko: "Voice With AI 서비스 안내", en: "Welcome to Voice With AI", ja: "Voice With AI サービスのご案内" },
    summary: { ko: "Discord에서 AI 캐릭터와 텍스트와 음성으로 대화하는 방법을 안내합니다.", en: "Learn how to talk with AI characters by text and voice on Discord.", ja: "DiscordでAIキャラクターとテキスト・音声で会話する方法をご案内します。" },
    content: {
      ko: ["Voice With AI는 Discord에서 AI 캐릭터와 텍스트·음성으로 대화할 수 있는 서비스입니다.", "대시보드에서 Discord 계정을 연결하고, 봇을 서버에 초대한 뒤 캐릭터 설정과 음성 처리 동의를 확인하면 이용을 시작할 수 있습니다.", "서비스 업데이트, 점검, 이벤트 소식은 이 공지사항에서 안내합니다."],
      en: ["Voice With AI lets you talk with AI characters by text and voice on Discord.", "Connect your Discord account from the dashboard, invite the bot to your server, then review character settings and voice-processing consent to begin.", "Service updates, maintenance notices, and events will be shared here."],
      ja: ["Voice With AIは、DiscordでAIキャラクターとテキスト・音声で会話できるサービスです。", "ダッシュボードからDiscordアカウントを連携し、ボットをサーバーに招待した後、キャラクター設定と音声処理への同意を確認すると利用を開始できます。", "サービス更新、メンテナンス、イベントのお知らせは、このページでご案内します。"],
    },
  },
  {
    slug: "updates-and-events",
    category: "update",
    publishedAt: "2026-08-17",
    title: { ko: "업데이트와 이벤트 소식은 공지사항에서 확인하세요", en: "Find updates and events here", ja: "アップデートとイベントのお知らせ" },
    summary: { ko: "새 기능, 점검 일정, 이벤트와 운영팀 전달 사항을 이 페이지에 올립니다.", en: "New features, maintenance schedules, events, and messages from the team will appear here.", ja: "新機能、メンテナンス予定、イベント、運営からのお知らせをこのページに掲載します。" },
    content: {
      ko: ["앞으로 새로운 캐릭터, 기능 업데이트, 서비스 점검, 이벤트 소식은 공지사항에 게시됩니다.", "중요한 변경 사항은 제목과 게시일을 함께 표시하므로 최신 공지를 먼저 확인해 주세요."],
      en: ["Future characters, feature updates, service maintenance, and events will be posted in Notices.", "Important changes include a title and date, so please check the most recent notice first."],
      ja: ["今後の新キャラクター、機能アップデート、メンテナンス、イベント情報はお知らせに掲載されます。", "重要な変更にはタイトルと掲載日を表示します。最新のお知らせからご確認ください。"],
    },
  },
];

export const noticeCategoryLabel: Record<NoticeCategory, { ko: string; en: string; ja: string }> = {
  notice: { ko: "안내", en: "Notice", ja: "ご案内" },
  event: { ko: "이벤트", en: "Event", ja: "イベント" },
  update: { ko: "업데이트", en: "Update", ja: "アップデート" },
};
