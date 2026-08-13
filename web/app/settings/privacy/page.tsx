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
  const guestLocale = cookieLocale === "ko-KR" ? "ko-KR" : "en-US";

  if (!session?.user?.email) {
    return <AutoGoogleSignIn callbackUrl="/settings/privacy" locale={guestLocale} />;
  }

  const profile = session?.user?.email ? await getUserProfileByEmail(session.user.email) : null;
  const locale = cookieLocale === "ko-KR" || profile?.locale === "ko-KR" ? "ko-KR" : "en-US";
  const ko = locale === "ko-KR";
  return <main className="site-wash min-h-screen px-6 py-12 text-[#493647]"><section className="mx-auto max-w-3xl">
    <p className="text-sm font-semibold text-[#d45d91]">Discord Anime AI</p><h1 className="mt-3 text-4xl font-bold">{ko ? "설정" : "Settings"}</h1><p className="mt-3 text-sm text-[#806579]">{ko ? "서비스 화면과 AI 응답에 사용할 환경을 설정할 수 있습니다." : "Choose the preferences used by the website and AI responses."}</p>
    <section className="mt-8 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><h2 className="text-lg font-bold text-[#684b60]">{ko ? "언어 설정" : "Language"}</h2><p className="mt-2 text-sm text-[#92768a]">{ko ? "선택한 언어가 웹사이트 UI와 Discord AI 응답에 함께 적용됩니다." : "Your selected language applies to the website UI and Discord AI responses."}</p><div className="mt-4"><LanguageSettings initialLocale={locale} /></div></section>
    <section className="mt-6 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><h2 className="text-lg font-bold text-[#684b60]">{ko ? "화면 테마" : "Theme"}</h2><p className="mt-2 text-sm text-[#92768a]">{ko ? "편안하게 사용할 화면 모드를 선택하세요." : "Choose the screen mode that feels comfortable."}</p><div className="mt-4"><ThemeToggle locale={locale} /></div></section>
    <section className="mt-6 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><label className="flex items-center gap-3 text-base font-extrabold text-[#684b60]"><input type="checkbox" checked disabled readOnly className="h-4 w-4" /><span>{ko ? "필수 약관 동의" : "Required consents"}</span></label><div className="mt-5 space-y-4 text-sm">{[[ko ? "[필수] 서비스 이용약관" : "[Required] Terms of Service", "/terms"], [ko ? "[필수] 개인정보 수집 및 이용" : "[Required] Privacy collection and use", "/privacy"], [ko ? "[필수] 개인정보 국외 이전" : "[Required] Overseas transfer of personal data", "/privacy"], [ko ? "[필수] 장기기억 저장" : "[Required] Long-term memory storage", "/privacy"], [ko ? "[필수] 음성 데이터 처리" : "[Required] Voice data processing", "/voice-policy"]].map(([text, href]) => <div key={href + text} className="flex items-center justify-between gap-3"><span className="flex items-center gap-3 font-semibold text-[#76566b]"><input type="checkbox" checked disabled readOnly />{text}</span><Link href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-[#d45d91] hover:text-[#b94c7d]">[{ko ? "상세보기" : "View details"}]</Link></div>)}</div></section>
    <AccountDeletionButton locale={locale} />
  </section></main>;
}
