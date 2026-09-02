"use client";

import { useState } from "react";
import type { ReactNode } from "react";
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

const plans: Plan[] = [
  { code: "free", name: "Free", monthly: 0, yearly: 0 },
  { code: "like", name: "Like♥", monthly: 5900, yearly: 59000 },
  { code: "more-like", name: "More♥Like", monthly: 15900, yearly: 159000 },
  { code: "love", name: "Love♥", monthly: 35900, yearly: 359000 },
];

function price(value: number, locale: Locale) {
  return locale === "ja-JP" ? `¥${value.toLocaleString("ja-JP")}` : locale === "en-US" ? `₩${value.toLocaleString("en-US")}` : `${value.toLocaleString("ko-KR")}원`;
}

export function CreditPanel({ locale, children }: { locale: AppLocale; children?: ReactNode }) {
  const copy = getMessages(locale).credits;

  return <section className="billing-status mb-0">
    <div>
      <div>
        <p className="status-label">{copy.label}</p>
        <p className="mt-2 text-xl font-extrabold text-[#684b60]">{copy.comingSoon}</p>
      </div>
    </div>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-[#92768a]">{copy.note}</p>
    {children ? <div className="mt-5 border-t border-[#efd8e5] pt-5">{children}</div> : null}
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
          <ul className="mt-7 space-y-4 text-sm text-[#76566b]">{planCopy.features.map((feature) => <li key={feature} className={`flex items-center gap-3 ${plan.code === "love" && feature === "풍성하게 즐기는 음성 대화" ? "whitespace-nowrap" : ""}`}><span className="check-mark">✓</span>{feature}</li>)}</ul>
          <button type="button" disabled={!requireLoginForAction} onClick={() => void signIn("google", { callbackUrl: "/billing" })} className={`plan-action ${requireLoginForAction ? "plan-action-login" : isCurrent ? "plan-action-current" : "plan-action-disabled"}`}>{requireLoginForAction ? copy.selectAfterLogin : isCurrent ? copy.currentPlan : copy.paymentSoon}</button>
        </article>;
      })}
    </div>
    <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-[#92768a]">{copy.voiceUsageNote}</p>
  </>;
}
