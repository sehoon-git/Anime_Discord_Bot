import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import {
  type BillingStatus,
  getBillingStatusForUser,
} from "@/app/lib/billing";

export const dynamic = "force-dynamic";

const PLAN_CARDS = [
  {
    code: "free",
    name: "Free",
    price: 0,
    badge: "기본",
    description: "서비스를 가볍게 테스트하는 기본 요금제입니다.",
    features: [
      "월 텍스트 100회",
      "월 음성 10분",
      "기억 기능 없음",
      "Discord 계정 연동 가능",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    price: 9900,
    badge: "결제 연동 예정",
    description: "실제 서비스 운영을 위한 유료 요금제입니다.",
    features: [
      "월 텍스트 3,000회",
      "월 음성 300분",
      "기억 기능 사용",
      "결제 성공 시 자동 활성화 예정",
    ],
  },
] as const;

function formatPrice(price: number) {
  if (price === 0) {
    return "무료";
  }

  return `${price.toLocaleString("ko-KR")}원 / 월`;
}

function formatLimit(used: number, limit: number) {
  return `${used.toLocaleString("ko-KR")} / ${limit.toLocaleString("ko-KR")}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "기간 제한 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const percent =
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-zinc-200">{label}</span>
        <span className="text-zinc-400">{formatLimit(used, limit)}</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  currentPlanCode,
}: {
  plan: (typeof PLAN_CARDS)[number];
  currentPlanCode: string;
}) {
  const isCurrent = plan.code === currentPlanCode;

  return (
    <article
      className={`rounded-lg border p-6 ${
        isCurrent
          ? "border-indigo-400 bg-indigo-950/30"
          : "border-zinc-800 bg-zinc-950/70"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{plan.name}</h2>
          <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
        </div>

        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
          {isCurrent ? "사용 중" : plan.badge}
        </span>
      </div>

      <p className="mt-6 text-3xl font-semibold">{formatPrice(plan.price)}</p>

      <ul className="mt-6 space-y-3 text-sm text-zinc-300">
        {plan.features.map((feature) => (
          <li key={feature}>- {feature}</li>
        ))}
      </ul>

      <button
        disabled
        className={`mt-8 w-full rounded-lg px-4 py-3 text-sm font-semibold ${
          isCurrent
            ? "bg-zinc-800 text-zinc-400"
            : "border border-zinc-700 text-zinc-400"
        }`}
      >
        {isCurrent ? "현재 요금제" : "결제 버튼 준비 중"}
      </button>
    </article>
  );
}

function LoginRequired() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-zinc-800 bg-zinc-950/70 p-8">
        <p className="text-sm font-semibold text-indigo-300">
          Discord Anime AI
        </p>
        <h1 className="mt-3 text-3xl font-semibold">로그인이 필요합니다</h1>
        <p className="mt-4 text-zinc-400">
          요금제와 사용량은 로그인한 사용자 기준으로 저장됩니다.
        </p>

        <Link
          href="/api/auth/signin"
          className="mt-8 inline-flex rounded-lg bg-indigo-500 px-5 py-3 text-sm font-semibold text-white"
        >
          로그인하기
        </Link>
      </section>
    </main>
  );
}

function SetupRequired() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-amber-700 bg-amber-950/20 p-8">
        <p className="text-sm font-semibold text-amber-300">DB 설정 필요</p>
        <h1 className="mt-3 text-3xl font-semibold">
          결제용 테이블을 먼저 만들어야 합니다
        </h1>
        <p className="mt-4 text-zinc-300">
          Neon SQL Editor에서 <code>web/docs/billing_schema.sql</code> 내용을
          전체 실행하면 Free/Pro 요금제와 구독 테이블이 준비됩니다.
        </p>
      </section>
    </main>
  );
}

function BillingDashboard({ billing }: { billing: BillingStatus }) {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div>
          <p className="text-sm font-semibold text-indigo-300">
            Discord Anime AI
          </p>
          <h1 className="mt-3 text-4xl font-semibold">요금제</h1>
          <p className="mt-4 max-w-2xl text-zinc-400">
            지금은 결제 버튼을 붙이기 전 단계입니다. DB에 저장된 구독 상태와
            이번 달 사용량을 먼저 확인합니다.
          </p>
        </div>

        <section className="mt-10 rounded-lg border border-zinc-800 bg-zinc-950/70 p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-zinc-500">현재 요금제</p>
              <p className="mt-2 text-2xl font-semibold">
                {billing.plan.name}
              </p>
            </div>

            <div>
              <p className="text-sm text-zinc-500">구독 상태</p>
              <p className="mt-2 text-2xl font-semibold">
                {billing.subscription.status}
              </p>
            </div>

            <div>
              <p className="text-sm text-zinc-500">구독 기간</p>
              <p className="mt-2 text-sm text-zinc-300">
                {formatDate(billing.subscription.currentPeriodStart)} -{" "}
                {formatDate(billing.subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <UsageBar
              label="이번 달 텍스트 사용량"
              used={billing.usage.textMessages}
              limit={billing.plan.monthlyTextMessages}
            />
            <UsageBar
              label="이번 달 음성 사용량"
              used={billing.usage.voiceMinutes}
              limit={billing.plan.monthlyVoiceMinutes}
            />
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          {PLAN_CARDS.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              currentPlanCode={billing.plan.code}
            />
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/70 p-6">
          <h2 className="text-xl font-semibold">다음에 붙일 결제 흐름</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
            <li>토스페이먼츠 또는 Stripe에서 결제 세션을 만듭니다.</li>
            <li>결제 성공 webhook을 받아 subscriptions 상태를 바꿉니다.</li>
            <li>봇 사용 시 usage_events에 사용량을 쌓습니다.</li>
            <li>무료 한도를 넘으면 봇과 웹에서 업그레이드를 안내합니다.</li>
          </ol>
        </section>
      </section>
    </main>
  );
}

export default async function BillingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return <LoginRequired />;
  }

  let billing;

  try {
    billing = await getBillingStatusForUser(
      session.user.email,
      session.user.name,
    );
  } catch (error) {
    console.error("[billing][page]", error);

    return <SetupRequired />;
  }

  return <BillingDashboard billing={billing} />;
}
