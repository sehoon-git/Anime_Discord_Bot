"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";

type Locale = "en" | "ko";
type BillingPlansProps = { currentPlanCode: string; locale?: Locale; showCreditPanel?: boolean; requireLoginForAction?: boolean };
type Plan = {
  code: string;
  name: string;
  monthly: number;
  yearly: number;
  badge: { en: string; ko: string };
  description: { en: string; ko: string };
  features: { en: string; ko: string }[];
};
type CreditState = { balance: number; usage: number } | null;

const plans: Plan[] = [
  { code: "like", name: "Like♥", monthly: 5900, yearly: 59000, badge: { en: "A gentle start", ko: "가볍게 시작" }, description: { en: "A lovely way to get a little closer to your favorite character every day.", ko: "좋아하는 캐릭터와 매일 조금씩 가까워져요." }, features: [{ en: "500 text messages / month", ko: "월 텍스트 500회" }, { en: "30 voice minutes / month", ko: "월 음성 30분" }, { en: "Basic character selection", ko: "기본 캐릭터 선택" }, { en: "Discord account connection", ko: "Discord 계정 연동" }] },
  { code: "more-like", name: "More♥Like", monthly: 15900, yearly: 159000, badge: { en: "Most popular", ko: "가장 인기" }, description: { en: "Made for anyone who wants longer, deeper conversations every day.", ko: "더 오래, 더 깊게 대화하고 싶은 분을 위한 플랜이에요." }, features: [{ en: "3,000 text messages / month", ko: "월 텍스트 3,000회" }, { en: "300 voice minutes / month", ko: "월 음성 300분" }, { en: "Long-term memory", ko: "장기기억 기능 사용" }, { en: "Priority character responses", ko: "캐릭터 우선 응답" }] },
  { code: "love", name: "Love♥", monthly: 35900, yearly: 359000, badge: { en: "Talk freely", ko: "마음껏 대화" }, description: { en: "Fill your time with the richest, most personal character experience.", ko: "캐릭터와의 시간을 가장 풍성하게 채워보세요." }, features: [{ en: "10,000 text messages / month", ko: "월 텍스트 10,000회" }, { en: "1,000 voice minutes / month", ko: "월 음성 1,000분" }, { en: "Expanded long-term memory", ko: "장기기억 확장 사용" }, { en: "Early access to new features", ko: "새 기능 먼저 만나기" }] },
];

function price(value: number, locale: Locale) {
  return locale === "en" ? `₩${value.toLocaleString("en-US")}` : `${value.toLocaleString("ko-KR")}원`;
}

export function CreditPanel({ locale }: { locale: Locale }) {
  const [credits, setCredits] = useState<CreditState>(null);
  const [pending, setPending] = useState(false);
  const en = locale === "en";

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
        <p className="status-label">{en ? "Test credits" : "테스트 크레딧"}</p>
        <p className="status-value">{credits ? credits.balance.toLocaleString() : "-"} <span className="text-base font-semibold">{en ? "credits left" : "크레딧 남음"}</span></p>
      </div>
      <p className="text-sm text-[#76566b]">{en ? `Used this month: ${credits?.usage.toLocaleString() ?? "-"}` : `이번 달 사용: ${credits?.usage.toLocaleString() ?? "-"} 크레딧`}</p>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={addTestCredits} disabled={pending} className="rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
        {pending ? (en ? "Adding..." : "추가 중...") : (en ? "+1,000 test credits" : "테스트 크레딧 +1000")}
      </button>
      <span className="text-xs text-[#92768a]">{en ? "Temporary test top-up. No payment is charged." : "임시 테스트용 충전이며 실제 결제는 발생하지 않습니다."}</span>
    </div>
  </section>;
}

export default function BillingPlans({ currentPlanCode, locale = "ko", showCreditPanel = true, requireLoginForAction = false }: BillingPlansProps) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const mappedCurrent = currentPlanCode === "free" ? "like" : currentPlanCode === "pro" ? "more-like" : currentPlanCode;
  const en = locale === "en";

  return <>
    {showCreditPanel ? <CreditPanel locale={locale} /> : null}
    <div className="billing-period" role="group" aria-label={en ? "Billing period" : "구독 주기"}>
      <button type="button" className={period === "monthly" ? "billing-period-active" : "billing-period-idle"} onClick={() => setPeriod("monthly")}>{en ? "Monthly" : "월간 구독"}</button>
      <button type="button" className={period === "yearly" ? "billing-period-active" : "billing-period-idle"} onClick={() => setPeriod("yearly")}>{en ? "Yearly" : "연간 구독"} <span>{en ? "2 months free" : "2개월 무료"}</span></button>
    </div>
    <div className="mt-4 grid gap-6 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.code === mappedCurrent;
        const displayPrice = period === "monthly" ? plan.monthly : plan.yearly;
        return <article key={plan.code} className={`plan-card group ${isCurrent ? "plan-card-current" : plan.code === "more-like" ? "plan-card-pro" : "plan-card-love"}`}>
          <div className="flex items-start justify-between gap-3"><div><span className="text-sm font-bold text-[#d45d91]">{isCurrent ? (en ? "Currently using" : "현재 사용 중") : plan.badge[locale]}</span><h2 className="mt-3 text-3xl font-extrabold text-[#5b4054]">{plan.name}</h2></div>{plan.code === "more-like" ? <span className="plan-recommend">{en ? "Popular" : "추천"}</span> : null}</div>
          <p className="mt-4 min-h-12 text-sm leading-6 text-[#92768a]">{plan.description[locale]}</p>
          <div className="mt-8 min-h-[4.75rem]">{period === "yearly" ? <p className="billing-original-price">{price(plan.monthly * 12, locale)} / {en ? "year" : "년"}</p> : null}<p className="text-3xl font-extrabold text-[#684b60]">{price(displayPrice, locale)} <span className="text-sm font-bold text-[#a17f93]">/ {en ? (period === "monthly" ? "month" : "year") : (period === "monthly" ? "월" : "년")}</span></p>{period === "yearly" ? <p className="billing-discount-note">{en ? "2 months free applied" : "2개월 무료 적용"}</p> : null}</div>
          <ul className="mt-7 space-y-4 text-sm text-[#76566b]">{plan.features.map((feature) => <li key={feature.en} className="flex items-center gap-3"><span className="check-mark">✓</span>{feature[locale]}</li>)}</ul>
          <button type="button" disabled={!requireLoginForAction} onClick={() => void signIn("google", { callbackUrl: "/billing" })} className={`plan-action ${requireLoginForAction ? "plan-action-login" : isCurrent ? "plan-action-current" : "plan-action-disabled"}`}>{requireLoginForAction ? (en ? "Sign in to choose this plan" : "로그인 후 플랜 선택하기") : isCurrent ? (en ? "Current plan" : "현재 요금제") : (en ? "Payment coming soon" : "결제 기능 준비 중")}</button>
        </article>;
      })}
    </div>
  </>;
}
