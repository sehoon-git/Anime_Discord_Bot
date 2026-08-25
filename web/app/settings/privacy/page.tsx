import { cookies } from "next/headers";
import Link from "next/link";
import { getServerSession } from "next-auth";

import AccountDeletionButton from "@/app/_components/AccountDeletionButton";
import LanguageSettings from "@/app/_components/LanguageSettings";
import ThemeToggle from "@/app/_components/ThemeToggle";
import { authOptions } from "@/app/lib/auth";
import AutoGoogleSignIn from "@/app/_components/AutoGoogleSignIn";
import { getUserProfileByEmail } from "@/app/lib/users";

export default async function PrivacySettingsPage() {
  const session = await getServerSession(authOptions);
  const cookieLocale = (await cookies()).get("locale")?.value;
  const guestLocale = cookieLocale === "ko-KR" || cookieLocale === "ja-JP" ? cookieLocale : "en-US";

  if (!session?.user?.email) {
    return <AutoGoogleSignIn callbackUrl="/settings/privacy" locale={guestLocale} />;
  }

  const profile = session?.user?.email ? await getUserProfileByEmail(session.user.email) : null;
  const locale = cookieLocale === "ko-KR" || cookieLocale === "ja-JP" ? cookieLocale : profile?.locale === "ko-KR" || profile?.locale === "ja-JP" ? profile.locale : "en-US";
  const ko = locale === "ko-KR";
  const ja = locale === "ja-JP";
  return <main className="site-wash min-h-screen px-6 py-12 text-[#493647]"><section className="mx-auto max-w-3xl">
    <p className="text-sm font-semibold text-[#d45d91]">Voice With AI</p><h1 className="mt-3 text-4xl font-bold">{ko ? "설정" : ja ? "設定" : "Settings"}</h1><p className="mt-3 text-sm text-[#806579]">{ko ? "서비스 화면과 AI 응답에 사용할 환경을 설정할 수 있습니다." : ja ? "ウェブサイトとAI応答に使用する環境を設定できます。" : "Choose the preferences used by the website and AI responses."}</p>
    <section className="mt-8 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><h2 className="text-lg font-bold text-[#684b60]">{ko ? "언어 설정" : ja ? "言語設定" : "Language"}</h2><p className="mt-2 text-sm text-[#92768a]">{ko ? "선택한 언어가 웹사이트 UI와 Discord AI 응답에 함께 적용됩니다." : ja ? "選択した言語はウェブサイトのUIとDiscord AIの応答に適用されます。" : "Your selected language applies to the website UI and Discord AI responses."}</p><div className="mt-4"><LanguageSettings initialLocale={locale} /></div></section>
    <section className="mt-6 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><h2 className="text-lg font-bold text-[#684b60]">{ko ? "화면 테마" : ja ? "画面テーマ" : "Theme"}</h2><p className="mt-2 text-sm text-[#92768a]">{ko ? "편안하게 사용할 화면 모드를 선택하세요." : ja ? "使いやすい画面モードを選択してください。" : "Choose the screen mode that feels comfortable."}</p><div className="mt-4"><ThemeToggle locale={locale} /></div></section>
    <section className="mt-6 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><label className="flex items-center gap-3 text-base font-extrabold text-[#684b60]"><input type="checkbox" checked disabled readOnly className="h-4 w-4" /><span>{ko ? "필수 약관 동의" : ja ? "必須規約への同意" : "Required consents"}</span></label><div className="mt-5 space-y-4 text-sm">{[[ko ? "[필수] 서비스 이용약관" : ja ? "[必須] サービス利用規約" : "[Required] Terms of Service", "/terms"], [ko ? "[필수] 개인정보 수집 및 이용" : ja ? "[必須] 個人情報の収集・利用" : "[Required] Privacy collection and use", "/privacy"], [ko ? "[필수] 개인정보 국외 이전" : ja ? "[必須] 個人情報の海外移転" : "[Required] Overseas transfer of personal data", "/privacy"], [ko ? "[필수] 장기기억 저장" : ja ? "[必須] 長期記憶の保存" : "[Required] Long-term memory storage", "/privacy"], [ko ? "[필수] 음성 데이터 처리" : ja ? "[必須] 音声データの処理" : "[Required] Voice data processing", "/voice-policy"], [ko ? "[필수] 접속 IP 주소 수집·이용 (계정 보안 및 부정 이용 방지)" : ja ? "[必須] 接続 IP アドレスの収集・利用（アカウント保護・不正利用防止）" : "[Required] Connection IP address collection and use (account security and abuse prevention)", "/privacy"]].map(([text, href]) => <div key={href + text} className="flex items-center justify-between gap-3"><span className="flex items-center gap-3 font-semibold text-[#76566b]"><input type="checkbox" checked disabled readOnly />{text}</span><Link href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-[#d45d91] hover:text-[#b94c7d]">[{ko ? "상세보기" : ja ? "詳細を見る" : "View details"}]</Link></div>)}</div><p className="mt-4 text-xs leading-5 text-[#92768a]">{ko ? "최근 접속 IP 주소는 계정 보안·반복 악용 탐지·제재 처리 목적으로 수집하며, 마지막 접속일로부터 90일 뒤 자동 삭제됩니다." : ja ? "直近の接続 IP アドレスは、アカウント保護、不正利用の検知・利用制限の運用のために収集し、最終接続日から 90 日後に自動削除します。" : "Recent connection IP addresses are collected for account security, abuse detection, and restriction administration, and are automatically deleted 90 days after the last connection."}</p></section>
    <AccountDeletionButton locale={locale} />
  </section></main>;
}
