"use client";

import { useState } from "react";

type BillingPlansProps = { currentPlanCode: string };
type Plan = { code: string; name: string; monthly: number; yearly: number; badge: string; description: string; features: string[] };

const plans: Plan[] = [
  { code: "like", name: "Like♥", monthly: 5900, yearly: 59000, badge: "가볍게 시작", description: "좋아하는 캐릭터와 매일 조금씩 가까워져요.", features: ["월 텍스트 500회", "월 음성 30분", "기본 캐릭터 선택", "Discord 계정 연동"] },
  { code: "more-like", name: "More♥Like", monthly: 15900, yearly: 159000, badge: "가장 인기", description: "더 오래, 더 깊게 대화하고 싶은 분에게 잘 맞아요.", features: ["월 텍스트 3,000회", "월 음성 300분", "장기기억 기능 사용", "캐릭터 우선 응답"] },
  { code: "love", name: "Love♥", monthly: 35900, yearly: 359000, badge: "마음껏 대화", description: "캐릭터와의 시간을 가장 풍성하게 채워보세요.", features: ["월 텍스트 10,000회", "월 음성 1,000분", "장기기억 확장 사용", "새 기능 먼저 만나기"] },
];

function price(value: number) { return `${value.toLocaleString("ko-KR")}원`; }

export default function BillingPlans({ currentPlanCode }: BillingPlansProps) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const mappedCurrent = currentPlanCode === "free" ? "like" : currentPlanCode === "pro" ? "more-like" : currentPlanCode;

  return (
    <>
      <div className="billing-period" role="group" aria-label="구독 주기">
        <button type="button" className={period === "monthly" ? "billing-period-active" : "billing-period-idle"} onClick={() => setPeriod("monthly")}>월간 구독</button>
        <button type="button" className={period === "yearly" ? "billing-period-active" : "billing-period-idle"} onClick={() => setPeriod("yearly")}>연간 구독 <span>2개월 무료</span></button>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.code === mappedCurrent;
          const displayPrice = period === "monthly" ? plan.monthly : plan.yearly;
          return (
            <article key={plan.code} className={`plan-card group ${isCurrent ? "plan-card-current" : plan.code === "more-like" ? "plan-card-pro" : "plan-card-love"}`}>
              <div className="flex items-start justify-between gap-3">
                <div><span className="text-sm font-bold text-[#d45d91]">{isCurrent ? "현재 사용 중" : plan.badge}</span><h2 className="mt-3 text-3xl font-extrabold text-[#5b4054]">{plan.name}</h2></div>
                {plan.code === "more-like" ? <span className="plan-recommend">추천</span> : null}
              </div>
              <p className="mt-4 min-h-12 text-sm leading-6 text-[#92768a]">{plan.description}</p>
              <div className="mt-8 min-h-[4.75rem]">
                {period === "yearly" ? (
                  <p className="billing-original-price">{price(plan.monthly * 12)} / 년</p>
                ) : null}
                <p className="text-3xl font-extrabold text-[#684b60]">
                  {price(displayPrice)} <span className="text-sm font-bold text-[#a17f93]">/ {period === "monthly" ? "월" : "년"}</span>
                </p>
                {period === "yearly" ? <p className="billing-discount-note">2개월 무료 적용</p> : null}
              </div>
              <ul className="mt-7 space-y-4 text-sm text-[#76566b]">{plan.features.map((feature) => <li key={feature} className="flex items-center gap-3"><span className="check-mark">✓</span>{feature}</li>)}</ul>
              <button type="button" disabled className={`plan-action ${isCurrent ? "plan-action-current" : "plan-action-disabled"}`}>{isCurrent ? "현재 요금제" : "결제 기능 준비 중"}</button>
            </article>
          );
        })}
      </div>
    </>
  );
}
