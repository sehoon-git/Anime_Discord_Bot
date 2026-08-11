import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

import AssistantSettings from "@/app/_components/AssistantSettings";
import LanguageSettings from "@/app/_components/LanguageSettings";
import ThemeToggle from "@/app/_components/ThemeToggle";
import { authOptions } from "@/app/lib/auth";
import { getUserProfileByEmail } from "@/app/lib/users";

export default async function PrivacySettingsPage() {
  const session = await getServerSession(authOptions);
  const profile = session?.user?.email ? await getUserProfileByEmail(session.user.email) : null;
  const cookieLocale = (await cookies()).get("locale")?.value;
  const locale = cookieLocale === "ko-KR" || profile?.locale === "ko-KR" ? "ko-KR" : "en-US";
  const ko = locale === "ko-KR";
  return <main className="site-wash min-h-screen px-6 py-12 text-[#493647]"><section className="mx-auto max-w-3xl">
    <p className="text-sm font-semibold text-[#d45d91]">Discord Anime AI</p><h1 className="mt-3 text-4xl font-bold">{ko ? "설정" : "Settings"}</h1><p className="mt-3 text-sm text-[#806579]">{ko ? "서비스 화면과 AI 응답에 사용할 환경을 설정할 수 있습니다." : "Choose the preferences used by the website and AI responses."}</p>
    <section className="mt-8 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><h2 className="text-lg font-bold text-[#684b60]">{ko ? "언어 설정" : "Language"}</h2><p className="mt-2 text-sm text-[#92768a]">{ko ? "선택한 언어가 웹사이트 UI와 Discord AI 응답에 함께 적용됩니다." : "Your selected language applies to the website UI and Discord AI responses."}</p><div className="mt-4"><LanguageSettings initialLocale={locale} /></div></section>
    <section className="mt-6 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><h2 className="text-lg font-bold text-[#684b60]">{ko ? "화면 테마" : "Theme"}</h2><p className="mt-2 text-sm text-[#92768a]">{ko ? "편안하게 사용할 화면 모드를 선택하세요." : "Choose the screen mode that feels comfortable."}</p><div className="mt-4"><ThemeToggle locale={locale} /></div></section>
    <AssistantSettings locale={locale} />
    <div className="mt-6 space-y-4"><label className="flex items-center justify-between rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-sm"><span className="font-semibold">{ko ? "음성 데이터 처리 동의 (필수)" : "Voice data processing consent (required)"}</span><input type="checkbox" checked disabled readOnly /></label><label className="flex items-center justify-between rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-sm"><span><span className="block font-semibold">{ko ? "장기기억 저장 동의 (필수)" : "Long-term memory consent (required)"}</span><span className="mt-1 block text-sm text-[#92768a]">{ko ? "저장된 기억은 기억 관리에서 언제든 삭제할 수 있습니다." : "Saved memories can be deleted anytime from Memory."}</span></span><input type="checkbox" checked disabled readOnly /></label><label className="flex items-center justify-between rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-sm"><span>{ko ? "AI API 국외 처리 동의 (필수)" : "Consent to overseas AI API processing (required)"}</span><input type="checkbox" checked disabled readOnly /></label></div>
  </section></main>;
}
