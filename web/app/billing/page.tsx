"use client";

import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  price: number;
  description: string;
  buttonText: string;
  featured?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    id: "Like♥",
    name: "Like♥",
    price: 9900,
    description: "가볍게 AI 캐릭터와 대화를 시작",
    buttonText: "Like 시작하기",
    features: [
      "AI 캐릭터 1개 사용",
      "월 1,000회 텍스트 대화",
      "월 60분 음성 대화",
      "기본 한국어 음성",
      "기본 서버 설정",
    ],
  },
  {
    id: "More♥like",
    name: "More♥like",
    price: 19900,
    description: "더 많은 대화와 음성 기능 이용",
    buttonText: "More♥like 시작하기",
    features: [
      "AI 캐릭터 3개 사용",
      "월 5,000회 텍스트 대화",
      "월 300분 음성 대화",
      "캐릭터 기억 기능",
      "음성 채널 자동 응답",
      "서버별 캐릭터 설정",
    ],
  },
  {
    id: "Love♥",
    name: "Love♥",
    price: 39900,
    description: "대형 서버를 위한 프리미엄 플랜",
    buttonText: "Love♥ 시작하기",
    featured: true,
    features: [
      "AI 캐릭터 10개 사용",
      "월 20,000회 텍스트 대화",
      "월 1,000분 음성 대화",
      "고급 기억 관리",
      "우선 응답 처리",
      "커스텀 캐릭터 설정",
      "고급 음성 프로필",
    ],
  },
];

const paymentMethods = [
  {
    id: "google_pay",
    name: "Google Pay",
    logo: "G Pay",
    className: "bg-white text-black hover:bg-zinc-200",
  },
  {
    id: "paypal",
    name: "PayPal",
    logo: "PayPal",
    className: "bg-[#ffc439] text-[#111820] hover:bg-[#f2b72f]",
  },
  {
    id: "kakao_pay",
    name: "Kakao Pay",
    logo: "kakao pay",
    className: "bg-[#fee500] text-[#191919] hover:bg-[#f4dc00]",
  },
];

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR");
}

export default function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );

  const isYearly = billingCycle === "yearly";

  function getPrice(plan: Plan) {
    return isYearly ? plan.price * 10 : plan.price;
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="text-center">
          <h1 className="text-4xl font-semibold">플랜 업그레이드</h1>

          <div className="mx-auto mt-6 flex w-[360px] rounded-full bg-zinc-800 p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`flex-1 rounded-full py-2 text-sm ${
                !isYearly ? "bg-zinc-700 text-white" : "text-zinc-400"
              }`}
            >
              월 결제
            </button>

            <button
              onClick={() => setBillingCycle("yearly")}
              className={`flex-1 rounded-full py-2 text-sm ${
                isYearly ? "bg-zinc-700 text-white" : "text-zinc-400"
              }`}
            >
              연 결제
            </button>
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`flex min-h-[620px] flex-col rounded-2xl border p-6 ${
                plan.featured
                  ? "border-blue-400 bg-[#274968]"
                  : "border-zinc-700 bg-[#202020]"
              }`}
            >
              <h2 className="text-3xl font-medium">{plan.name}</h2>

              <div className="mt-8">
                <span className="text-zinc-400">₩</span>
                <span className="text-5xl font-light">
                  {formatPrice(getPrice(plan))}
                </span>
                <span className="ml-2 text-sm">
                  KRW / {isYearly ? "년" : "월"}
                </span>
              </div>

              <p className="mt-5 text-base">{plan.description}</p>

              <button
                onClick={() => setSelectedPlan(plan)}
                className={`mt-8 rounded-full py-3 text-sm font-semibold transition ${
                  plan.featured
                    ? "bg-[#4aa8ff] text-white hover:bg-[#67b7ff]"
                    : "border border-zinc-600 text-white hover:bg-zinc-800"
                }`}
              >
                결제하기
              </button>

              <ul className="mt-8 space-y-5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className="text-lg">✦</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-10 text-xs text-zinc-400">
                이용 한도 적용
                <br />
                결제 관련 도움말 보기
              </div>
            </article>
          ))}
        </div>
      </section>

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-[#202020] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">결제수단 선택</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {selectedPlan.name} 플랜 · ₩{formatPrice(getPrice(selectedPlan))}
                  /{isYearly ? "년" : "월"}
                </p>
              </div>

              <button
                onClick={() => setSelectedPlan(null)}
                className="rounded-full px-3 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                X
              </button>
            </div>

            <div className="mt-8 space-y-3">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  className={`flex w-full items-center justify-center gap-3 rounded-xl px-4 py-4 font-bold transition ${method.className}`}
                >
                  <span className="rounded-md bg-white/80 px-2 py-1 text-xs font-black text-black">
                    {method.logo}
                  </span>
                  {method.name}로 결제
                </button>
              ))}
            </div>

            <p className="mt-5 text-center text-xs text-zinc-500">
              실제 결제 연동 전까지는 결제수단 선택 UI만 동작합니다.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}