"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { getMessages, type AppLocale } from "@/app/i18n/messages";

type Locale = AppLocale;
type BillingPlansProps = { currentPlanCode: string; locale?: Locale; showCreditPanel?: boolean; requireLoginForAction?: boolean };
type Plan = {
  code: string;
  name: string;
  monthly: number;
  yearly: number;
};
type CreditState = { balance: number; usage: number } | null;

const plans: Plan[] = [
  { code: "free", name: "Free", monthly: 0, yearly: 0 },
  { code: "like", name: "Like♥", monthly: 5900, yearly: 59000 },
  { code: "more-like", name: "More♥Like", monthly: 15900, yearly: 159000 },
  { code: "love", name: "Love♥", monthly: 35900, yearly: 359000 },
];

function price(value: number, locale: Locale) {
  return locale === "ja-JP" ? `¥${value.toLocaleString("ja-JP")}` : locale === "en-US" ? `₩${value.toLocaleString("en-US")}` : `${value.toLocaleString("ko-KR")}원`;
}

export function CreditPanel({ locale }: { locale: AppLocale }) {
  const [credits, setCredits] = useState<CreditState>(null);
  const [pending, setPending] = useState(false);
  const copy = getMessages(locale).credits;

  const refresh = useCallback(async () => {
    const response = await fetch("/api/billing/credits", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setCredits({ balance: body.credits.balance, usage: body.usage.creditsUsed });
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function addTestCredits() {
    setPending(true);
    try {
      const response = await fetch("/api/billing/credits", { method: "POST" });
      if (response.ok) await refresh();
    } finally {
      setPending(false);
    }
  }

  return <section className="billing-status mb-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="status-label">{copy.label}</p>
        <p className="status-value">{credits ? credits.balance.toLocaleString() : "-"} <span className="text-base font-semibold">{copy.remaining}</span></p>
      </div>
      <p className="text-sm text-[#76566b]">{copy.used(credits?.usage.toLocaleString() ?? "-")}</p>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={addTestCredits} disabled={pending} className="rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
        {pending ? copy.adding : copy.add}
      </button>
      <span className="text-xs text-[#92768a]">{copy.note}</span>
    </div>
  </section>;
}

export default function BillingPlans({ currentPlanCode, locale = "ko-KR", showCreditPanel = true, requireLoginForAction = false }: BillingPlansProps) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const mappedCurrent = currentPlanCode === "pro" ? "more-like" : currentPlanCode;
  const copy = getMessages(locale).billing;

  return <>
    {showCreditPanel ? <CreditPanel locale={locale} /> : null}
    <div className="billing-period" role="group" aria-label={copy.heading}>
      <button type="button" className={period === "monthly" ? "billing-period-active" : "billing-period-idle"} onClick={() => setPeriod("monthly")}>{copy.monthly}</button>
      <button type="button" className={period === "yearly" ? "billing-period-active" : "billing-period-idle"} onClick={() => setPeriod("yearly")}>{copy.yearly} <span>{copy.twoMonthsFree}</span></button>
    </div>
    <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan, index) => {
        const planCopy = copy.plans[index];
        const isCurrent = plan.code === mappedCurrent;
        const displayPrice = period === "monthly" ? plan.monthly : plan.yearly;
        return <article key={plan.code} className={`plan-card group ${isCurrent ? "plan-card-current" : plan.code === "more-like" ? "plan-card-pro" : "plan-card-love"}`}>
          <div className="flex items-start justify-between gap-3"><div><span className="text-sm font-bold text-[#d45d91]">{isCurrent ? copy.currentlyUsing : planCopy.badge}</span><h2 className="mt-3 text-3xl font-extrabold text-[#5b4054]">{plan.name}</h2></div>{plan.code === "more-like" ? <span className="plan-recommend">{copy.popular}</span> : null}</div>
          <p className="mt-4 min-h-12 text-sm leading-6 text-[#92768a]">{planCopy.description}</p>
          <div className="mt-8 min-h-[4.75rem]">{period === "yearly" ? <p className="billing-original-price">{price(plan.monthly * 12, locale)} / {copy.year}</p> : null}<p className="text-3xl font-extrabold text-[#684b60]">{price(displayPrice, locale)} <span className="text-sm font-bold text-[#a17f93]">/ {period === "monthly" ? copy.month : copy.year}</span></p>{period === "yearly" ? <p className="billing-discount-note">{copy.yearlyDiscount}</p> : null}</div>
          <ul className="mt-7 space-y-4 text-sm text-[#76566b]">{planCopy.features.map((feature) => <li key={feature} className="flex items-center gap-3"><span className="check-mark">✓</span>{feature}</li>)}</ul>
          <button type="button" disabled={!requireLoginForAction} onClick={() => void signIn("google", { callbackUrl: "/billing" })} className={`plan-action ${requireLoginForAction ? "plan-action-login" : isCurrent ? "plan-action-current" : "plan-action-disabled"}`}>{requireLoginForAction ? copy.selectAfterLogin : isCurrent ? copy.currentPlan : copy.paymentSoon}</button>
        </article>;
      })}
    </div>
    <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-[#92768a]">{copy.voiceUsageNote}</p>
  </>;
}
