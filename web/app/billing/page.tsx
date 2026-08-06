import { cookies } from "next/headers";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { type BillingStatus, getBillingStatusForUser } from "@/app/lib/billing";
import BillingPlans from "@/app/_components/BillingPlans";

export const dynamic = "force-dynamic";

type Locale = "en" | "ko";

function formatLimit(used: number, limit: number, locale: Locale) {
  return `${used.toLocaleString(locale === "en" ? "en-US" : "ko-KR")} / ${limit.toLocaleString(locale === "en" ? "en-US" : "ko-KR")}`;
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) return locale === "en" ? "No time limit" : "기간 제한 없음";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", { dateStyle: "medium" }).format(new Date(value));
}

function UsageBar({ label, used, limit, locale }: { label: string; used: number; limit: number; locale: Locale }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return <div className="usage-pill"><div className="flex items-center justify-between gap-4 text-sm"><span className="font-bold text-[#684b60]">{label}</span><span className="text-[#a17f93]">{formatLimit(used, limit, locale)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f3dfeb]"><div className="h-full rounded-full bg-gradient-to-r from-[#ef9bc1] to-[#aa98ee] transition-all" style={{ width: `${percent}%` }} /></div></div>;
}

function LoginRequired({ locale }: { locale: Locale }) {
  const en = locale === "en";
  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-3xl rounded-3xl border border-[#f0d7e5] bg-white/80 p-8 shadow-[0_20px_60px_rgba(198,135,169,0.16)]"><p className="text-sm font-semibold text-[#d45d91]">Discord Anime AI</p><h1 className="mt-3 text-3xl font-semibold text-[#5b4054]">{en ? "Login required" : "로그인이 필요합니다"}</h1><p className="mt-4 text-[#92768a]">{en ? "Please log in to view your subscription and usage." : "요금제와 사용량을 확인하려면 먼저 로그인해주세요."}</p><Link href="/api/auth/signin" className="mt-8 inline-flex rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-200/60">{en ? "Log in" : "로그인하기"}</Link></section></main>;
}

function SetupRequired({ locale }: { locale: Locale }) {
  const en = locale === "en";
  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-3xl rounded-3xl border border-[#f1c8d6] bg-[#fff6f9] p-8"><p className="text-sm font-semibold text-[#d45d91]">{en ? "Billing setup required" : "DB 설정 필요"}</p><h1 className="mt-3 text-3xl font-semibold text-[#5b4054]">{en ? "Billing is being prepared" : "결제 정보를 준비하고 있어요"}</h1><p className="mt-4 text-[#92768a]">{en ? "The plans will be available after billing data is configured." : "관리자가 결제 데이터를 설정하면 요금제를 이용할 수 있습니다."}</p></section></main>;
}

function BillingDashboard({ billing, locale }: { billing: BillingStatus; locale: Locale }) {
  const en = locale === "en";
  return <main className="site-wash min-h-screen px-6 py-12 text-[#493647]"><section className="mx-auto max-w-6xl"><div className="billing-intro text-center"><span className="billing-sparkle">✦</span><p className="text-sm font-bold text-[#d45d91]">Discord Anime AI · {en ? "plans" : "plans"}</p><h1 className="mt-4 text-5xl font-extrabold tracking-[-0.03em] text-[#5b4054]">{en ? "A plan that fits your conversations" : "나에게 맞는 대화 플랜"}</h1><p className="mx-auto mt-5 max-w-xl leading-7 text-[#92768a]">{en ? <>Start small or stay longer.<br />Choose what fits the way you talk today.</> : <>가볍게 시작하거나, 더 오래 대화하거나.<br />지금의 대화 습관에 맞춰 골라보세요.</>}</p></div><section className="billing-status mt-12"><div className="grid gap-6 md:grid-cols-3"><div><p className="status-label">{en ? "Current plan" : "현재 요금제"}</p><p className="status-value">{billing.plan.name}</p></div><div><p className="status-label">{en ? "Subscription status" : "구독 상태"}</p><p className="status-value">{billing.subscription.status}</p></div><div><p className="status-label">{en ? "Subscription period" : "구독 기간"}</p><p className="mt-2 text-sm text-[#76566b]">{formatDate(billing.subscription.currentPeriodStart, locale)} - {formatDate(billing.subscription.currentPeriodEnd, locale)}</p></div></div><div className="mt-7 grid gap-4 md:grid-cols-2"><UsageBar label={en ? "Text usage this month" : "이번 달 텍스트 사용량"} used={billing.usage.textMessages} limit={billing.plan.monthlyTextMessages} locale={locale} /><UsageBar label={en ? "Voice usage this month" : "이번 달 음성 사용량"} used={billing.usage.voiceMinutes} limit={billing.plan.monthlyVoiceMinutes} locale={locale} /></div></section><section className="mt-8"><BillingPlans currentPlanCode={billing.plan.code} locale={locale} /></section></section></main>;
}

export default async function BillingPage() {
  const locale: Locale = (await cookies()).get("locale")?.value === "ko-KR" ? "ko" : "en";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return <LoginRequired locale={locale} />;
  let billing: BillingStatus | null = null;
  try {
    billing = await getBillingStatusForUser(session.user.email, session.user.name);
  } catch (error) {
    console.error("[billing][page]", error);
  }
  if (!billing) return <SetupRequired locale={locale} />;
  return <BillingDashboard billing={billing} locale={locale} />;
}
