import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { type BillingStatus, getBillingStatusForUser } from "@/app/lib/billing";
import { getUserIdByEmail } from "@/app/lib/users";
import BillingPlans from "@/app/_components/BillingPlans";
import { getMessages, toAppLocale, type AppLocale } from "@/app/i18n/messages";

export const dynamic = "force-dynamic";

export function LoginRequired({ locale }: { locale: AppLocale }) {
  const copy = getMessages(locale).billing;
  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-3xl rounded-3xl border border-[#f0d7e5] bg-white/80 p-8 shadow-[0_20px_60px_rgba(198,135,169,0.16)]"><p className="text-sm font-semibold text-[#d45d91]">Voice With AI</p><h1 className="mt-3 text-3xl font-semibold text-[#5b4054]">{copy.loginTitle}</h1><p className="mt-4 text-[#92768a]">{copy.loginDescription}</p><p className="mt-3 text-sm font-semibold text-[#a4577e]">{copy.loginHint}</p></section></main>;
}

function SetupRequired({ locale }: { locale: AppLocale }) {
  const copy = getMessages(locale).billing;
  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-3xl rounded-3xl border border-[#f1c8d6] bg-[#fff6f9] p-8"><p className="text-sm font-semibold text-[#d45d91]">{copy.setupLabel}</p><h1 className="mt-3 text-3xl font-semibold text-[#5b4054]">{copy.setupTitle}</h1><p className="mt-4 text-[#92768a]">{copy.setupDescription}</p></section></main>;
}

function BillingDashboard({ billing, locale }: { billing?: BillingStatus; locale: AppLocale }) {
  const copy = getMessages(locale).billing;
  return <main className="site-wash min-h-screen px-6 py-3 text-[#493647]"><section className="mx-auto max-w-6xl"><div className="billing-intro billing-intro-compact text-center"><span className="billing-sparkle billing-sparkle-compact">✦</span><p className="text-sm font-bold text-[#d45d91]">Voice With AI · {copy.monthly}</p><h1 className="mt-1 text-4xl font-extrabold tracking-[-0.03em] text-[#5b4054]">{copy.heading}</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#92768a]">{copy.intro}</p></div><section className="mt-2"><BillingPlans currentPlanCode={billing?.plan.code ?? ""} locale={locale} showCreditPanel={false} requireLoginForAction={!billing} /></section></section></main>;
}

export default async function BillingPage() {
  const locale = toAppLocale((await cookies()).get("locale")?.value);
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
