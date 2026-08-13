import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { type BillingStatus, getBillingStatusForUser } from "@/app/lib/billing";
import { getUserIdByEmail } from "@/app/lib/users";
import BillingPlans from "@/app/_components/BillingPlans";

export const dynamic = "force-dynamic";

type Locale = "en" | "ko";

export function LoginRequired({ locale }: { locale: Locale }) {
  const en = locale === "en";
  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-3xl rounded-3xl border border-[#f0d7e5] bg-white/80 p-8 shadow-[0_20px_60px_rgba(198,135,169,0.16)]"><p className="text-sm font-semibold text-[#d45d91]">Voice With AI</p><h1 className="mt-3 text-3xl font-semibold text-[#5b4054]">{en ? "Login required" : "로그인이 필요합니다"}</h1><p className="mt-4 text-[#92768a]">{en ? "Please log in to view your subscription and usage." : "요금제와 사용량을 확인하려면 먼저 로그인해주세요."}</p><p className="mt-3 text-sm font-semibold text-[#a4577e]">{en ? "Use the account icon in the top-right corner to continue with Google." : "우측 상단 계정 아이콘에서 Google로 로그인을 선택해 주세요."}</p></section></main>;
}

function SetupRequired({ locale }: { locale: Locale }) {
  const en = locale === "en";
  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-3xl rounded-3xl border border-[#f1c8d6] bg-[#fff6f9] p-8"><p className="text-sm font-semibold text-[#d45d91]">{en ? "Billing setup required" : "DB 설정 필요"}</p><h1 className="mt-3 text-3xl font-semibold text-[#5b4054]">{en ? "Billing is being prepared" : "결제 정보를 준비하고 있어요"}</h1><p className="mt-4 text-[#92768a]">{en ? "The plans will be available after billing data is configured." : "관리자가 결제 데이터를 설정하면 요금제를 이용할 수 있습니다."}</p></section></main>;
}

function BillingDashboard({ billing, locale }: { billing?: BillingStatus; locale: Locale }) {
  const en = locale === "en";
  return <main className="site-wash min-h-screen px-6 py-3 text-[#493647]"><section className="mx-auto max-w-6xl"><div className="billing-intro billing-intro-compact text-center"><span className="billing-sparkle billing-sparkle-compact">✦</span><p className="text-sm font-bold text-[#d45d91]">Voice With AI · {en ? "plans" : "plans"}</p><h1 className="mt-1 text-4xl font-extrabold tracking-[-0.03em] text-[#5b4054]">{en ? "A plan that fits your conversations" : "나에게 맞는 대화 플랜"}</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#92768a]">{en ? "Choose the plan that fits how often you talk." : "대화 빈도와 이용 방식에 맞는 플랜을 골라보세요."}</p></div><section className="mt-2"><BillingPlans currentPlanCode={billing?.plan.code ?? ""} locale={locale} showCreditPanel={false} requireLoginForAction={!billing} /></section></section></main>;
}

export default async function BillingPage() {
  const locale: Locale = (await cookies()).get("locale")?.value === "ko-KR" ? "ko" : "en";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return <BillingDashboard locale={locale} />;
  const userId = await getUserIdByEmail(session.user.email);
  if (!userId || (await getMissingRequiredConsents(userId)).length > 0) redirect("/profile");
  let billing: BillingStatus | null = null;
  try {
    billing = await getBillingStatusForUser(session.user.email, session.user.name);
  } catch (error) {
    console.error("[billing][page]", error);
  }
  if (!billing) return <SetupRequired locale={locale} />;
  return <BillingDashboard billing={billing} locale={locale} />;
}
