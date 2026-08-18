export const supportedLocales = ["en-US", "ko-KR", "ja-JP"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export function toAppLocale(value?: string | null): AppLocale {
  return value === "ko-KR" || value === "ja-JP" ? value : "en-US";
}

export const messages = {
  "ko-KR": {
    nav: { plans: "요금제", dashboard: "대시보드", support: "문의 게시판", characters: "캐릭터 설정", notices: "공지사항", viewNotices: "공지사항 보기" },
    footer: { links: [["/notice", "서비스 공지"], ["/privacy", "개인정보처리방침"], ["/terms", "서비스 이용약관"], ["/voice-policy", "음성 데이터 정책"], ["/billing", "요금제"]], details: ["상호명: Voice With AI", "대표자명: 김세훈, 강창묵 | 사업자등록번호: 준비 중", "이메일: help@example.com"] },
    dashboard: {
      title: "대시보드", signedIn: (name: string) => `${name} 계정으로 로그인되었습니다.`, discordTitle: "Discord 계정 연동", linked: (name: string) => `${name} 계정과 연결되었습니다.`, unlinked: "봇 사용 권한을 확인하려면 Discord 계정을 연결해야 합니다.", reconnect: "Discord 계정 다시 연결하기", connect: "Discord 계정 연결하기", invite: "봇 초대하기", overviewTitle: "내 활동 한눈에 보기", overviewDescription: "이번 달 사용량과 대화 준비 상태를 확인하세요.", viewPlans: "요금제 보기", currentPlan: "현재 요금제", managePlan: "요금제 관리", savedMemories: "저장된 기억", count: (value: number) => `${value}개`, manageMemories: "기억 관리", profile: "내 프로필", profileDescription: "닉네임, 언어, 기본 프로필 정보를 관리합니다.", voiceSettings: "음성 대화 설정", voiceSettingsDescription: "음성 처리 동의와 대화 응답 설정을 확인합니다.", support: "문의 게시판", supportDescription: "Discord 문의 게시판에서 도움을 받을 수 있습니다.", backHome: "처음으로 돌아가기",
    },
    onboarding: { trigger: "이용방법 다시 보기", eyebrow: "처음 오셨나요?", title: "Voice With AI 시작하기", description: "아래 2단계만 완료하면 Discord에서 AI 캐릭터와 음성 대화를 시작할 수 있어요.", note: "이 안내는 언제든 대시보드에서 다시 열 수 있습니다.", close: "닫기", linked: "연결 완료", connect: "Discord 계정 연동하기", invite: "봇 초대하기", inviteLocked: "계정 연동 후 가능", steps: [{ title: "Discord 계정 연동", description: "웹 계정과 Discord 계정을 연결해 봇 사용 권한을 확인하세요." }, { title: "봇 초대", description: "연동한 뒤 AI 캐릭터를 사용할 Discord 서버로 봇을 초대하세요." }] },
    credits: { label: "테스트 크레딧", remaining: "크레딧 남음", used: (value: string) => `이번 달 사용: ${value} 크레딧`, adding: "추가 중...", add: "테스트 크레딧 +1000", note: "임시 테스트용 충전이며 실제 결제는 발생하지 않습니다." },
  },
  "ja-JP": {
    nav: { plans: "料金プラン", dashboard: "ダッシュボード", support: "お問い合わせ", characters: "キャラクター設定", notices: "お知らせ", viewNotices: "お知らせを見る" },
    footer: { links: [["/notice", "お知らせ"], ["/privacy", "プライバシーポリシー"], ["/terms", "利用規約"], ["/voice-policy", "音声データポリシー"], ["/billing", "料金プラン"]], details: ["事業者名: Voice With AI", "代表者名: キム・セフン、カン・チャンムク | 事業者登録番号: 準備中", "メール: help@example.com"] },
    dashboard: {
      title: "ダッシュボード", signedIn: (name: string) => `${name} さんとしてログインしています。`, discordTitle: "Discord アカウント連携", linked: (name: string) => `${name} と連携済みです。`, unlinked: "ボットの利用権限を確認するには、Discord アカウントを連携してください。", reconnect: "Discord アカウントを再連携", connect: "Discord アカウントを連携", invite: "ボットを招待", overviewTitle: "アクティビティの概要", overviewDescription: "今月の利用状況と会話の準備状況を確認できます。", viewPlans: "料金プランを見る", currentPlan: "現在のプラン", managePlan: "プランを管理", savedMemories: "保存した記憶", count: (value: number) => `${value}件`, manageMemories: "記憶を管理", profile: "プロフィール", profileDescription: "ニックネーム、言語、基本プロフィールを管理します。", voiceSettings: "音声会話の設定", voiceSettingsDescription: "音声データの同意と会話応答の設定を確認します。", support: "お問い合わせ", supportDescription: "Discord の問い合わせ窓口からサポートを受けられます。", backHome: "ホームに戻る",
    },
    onboarding: { trigger: "使い方をもう一度見る", eyebrow: "はじめての方へ", title: "Voice With AI をはじめよう", description: "次の2ステップを完了すると、Discord で AI キャラクターとの音声会話を始められます。", note: "このガイドはいつでもダッシュボードから開けます。", close: "閉じる", linked: "連携済み", connect: "Discord アカウントを連携", invite: "ボットを招待", inviteLocked: "連携後に利用可能", steps: [{ title: "Discord アカウントを連携", description: "Web アカウントと Discord を連携して、ボットの利用権限を確認します。" }, { title: "ボットを招待", description: "連携後、AI キャラクターを使う Discord サーバーにボットを招待します。" }] },
    credits: { label: "テストクレジット", remaining: "クレジット残高", used: (value: string) => `今月の利用: ${value} クレジット`, adding: "追加中...", add: "テストクレジット +1,000", note: "テスト用の一時チャージです。実際の決済は発生しません。" },
  },
  "en-US": {
    nav: { plans: "Plans", dashboard: "Dashboard", support: "Support", characters: "Characters", notices: "Notices", viewNotices: "View notices" },
    footer: { links: [["/notice", "Notices"], ["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"], ["/voice-policy", "Voice Data Policy"], ["/billing", "Plans"]], details: ["Business name: Voice With AI", "Representatives: Kim Se-hoon, Kang Chang-mook | Business registration: Coming soon", "Email: help@example.com"] },
    dashboard: {
      title: "Dashboard", signedIn: (name: string) => `Signed in as ${name}.`, discordTitle: "Discord account connection", linked: (name: string) => `Connected to ${name}.`, unlinked: "Connect your Discord account to verify bot access.", reconnect: "Reconnect Discord account", connect: "Connect Discord account", invite: "Invite the bot", overviewTitle: "Your activity at a glance", overviewDescription: "Check this month’s usage and your conversation setup.", viewPlans: "View plans", currentPlan: "Current plan", managePlan: "Manage plan", savedMemories: "Saved memories", count: (value: number) => `${value} saved`, manageMemories: "Manage memories", profile: "My profile", profileDescription: "Manage your nickname, language, and basic profile information.", voiceSettings: "Voice conversation settings", voiceSettingsDescription: "Review voice processing consent and conversation response settings.", support: "Support", supportDescription: "Get help through the Discord support board.", backHome: "Back to home",
    },
    onboarding: { trigger: "View getting started guide", eyebrow: "New here?", title: "Get started with Voice With AI", description: "Complete these two steps to start voice conversations with AI characters on Discord.", note: "You can reopen this guide anytime from the dashboard.", close: "Close", linked: "Connected", connect: "Connect Discord account", invite: "Invite the bot", inviteLocked: "Connect your account first", steps: [{ title: "Connect Discord", description: "Connect your web and Discord accounts to verify bot access." }, { title: "Invite the bot", description: "After connecting, invite the bot to the Discord server where you want to use it." }] },
    credits: { label: "Test credits", remaining: "credits left", used: (value: string) => `Used this month: ${value}`, adding: "Adding...", add: "+1,000 test credits", note: "Temporary test top-up. No payment is charged." },
  },
} as const;

export function getMessages(locale?: string | null) {
  return messages[toAppLocale(locale)];
}
