import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { type BillingStatus, getBillingStatusForUser } from "@/app/lib/billing";
import BillingPlans from "@/app/_components/BillingPlans";

export const dynamic = "force-dynamic";

const PLAN_CARDS = [
  {
    code: "free",
    name: "Free",
    price: 0,
    badge: "가볍게 시작",
    description: "좋아하는 캐릭터와 먼저 대화해보고 싶은 날에 잘 어울려요.",
    features: ["월 텍스트 100회", "월 음성 10분", "Discord 계정 연동", "기억 기능 미포함"],
  },
  {
    code: "pro",
    name: "Pro",
    price: 9900,
    badge: "더 오래 대화",
    description: "매일 캐릭터와 깊게 이야기하고 싶은 분을 위한 플랜이에요.",
    features: ["월 텍스트 3,000회", "월 음성 300분", "장기기억 기능 사용", "결제 후 자동 활성화 예정"],
  },
] as const;

function formatPrice(price: number) {
  return price === 0 ? "무료" : `${price.toLocaleString("ko-KR")}원 / 월`;
}

function formatLimit(used: number, limit: number) {
  return `${used.toLocaleString("ko-KR")} / ${limit.toLocaleString("ko-KR")}`;
}

function formatDate(value: string | null) {
  if (!value) return "기간 제한 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="usage-pill">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-bold text-[#684b60]">{label}</span>
        <span className="text-[#a17f93]">{formatLimit(used, limit)}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f3dfeb]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ef9bc1] to-[#aa98ee] transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PlanCard({ plan, currentPlanCode }: { plan: (typeof PLAN_CARDS)[number]; currentPlanCode: string }) {
  const isCurrent = plan.code === currentPlanCode;

  return (
    <article className={`plan-card group ${isCurrent ? "plan-card-current" : "plan-card-pro"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-sm font-bold text-[#d45d91]">{isCurrent ? "현재 사용 중" : "곧 만나요"}</span>
          <h2 className="mt-3 text-3xl font-extrabold text-[#5b4054]">{plan.name}</h2>
        </div>
        <span className="plan-badge">{isCurrent ? "사용 중" : plan.badge}</span>
      </div>
      <p className="mt-4 min-h-12 text-sm leading-6 text-[#92768a]">{plan.description}</p>
      <p className="mt-8 text-3xl font-extrabold text-[#684b60]">{formatPrice(plan.price)}</p>
      <ul className="mt-7 space-y-4 text-sm text-[#76566b]">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-3"><span className="check-mark">✓</span>{feature}</li>
        ))}
      </ul>
      <button disabled className={`plan-action ${isCurrent ? "plan-action-current" : "plan-action-disabled"}`}>
        {isCurrent ? "현재 요금제" : "결제 기능 준비 중"}
      </button>
    </article>
  );
}

function LoginRequired() {
  return (
    <main className="site-wash min-h-screen px-6 py-16 text-[#493647]">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#f0d7e5] bg-white/80 p-8 shadow-[0_20px_60px_rgba(198,135,169,0.16)]">
        <p className="text-sm font-semibold text-[#d45d91]">Discord Anime AI</p>
        <h1 className="mt-3 text-3xl font-semibold text-[#5b4054]">로그인이 필요합니다</h1>
        <p className="mt-4 text-[#92768a]">요금제와 사용량을 확인하려면 먼저 로그인해주세요.</p>
        <Link href="/api/auth/signin" className="mt-8 inline-flex rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-200/60">로그인하기</Link>
      </section>
    </main>
  );
}

function SetupRequired() {
  return (
    <main className="site-wash min-h-screen px-6 py-16 text-[#493647]">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#f1c8d6] bg-[#fff6f9] p-8">
        <p className="text-sm font-semibold text-[#d45d91]">DB 설정 필요</p>
        <h1 className="mt-3 text-3xl font-semibold text-[#5b4054]">결제 정보를 준비하고 있어요</h1>
        <p className="mt-4 text-[#92768a]">관리자가 결제 데이터베이스를 설정하면 Free/Pro 요금제를 이용할 수 있습니다.</p>
      </section>
    </main>
  );
}

function BillingDashboard({ billing }: { billing: BillingStatus }) {
  return (
    <main className="site-wash min-h-screen px-6 py-12 text-[#493647]">
      <section className="mx-auto max-w-6xl">
        <div className="billing-intro text-center">
          <span className="billing-sparkle">✦</span>
          <p className="text-sm font-bold text-[#d45d91]">Discord Anime AI · plans</p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-[-0.03em] text-[#5b4054]">나에게 맞는 대화 플랜</h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#92768a]">가볍게 시작하거나, 더 오래 대화하거나.<br />지금의 대화 습관에 맞춰 골라보세요.</p>
        </div>

        <section className="billing-status mt-12">
          <div className="grid gap-6 md:grid-cols-3">
            <div><p className="status-label">현재 요금제</p><p className="status-value">{billing.plan.name}</p></div>
            <div><p className="status-label">구독 상태</p><p className="status-value">{billing.subscription.status}</p></div>
            <div><p className="status-label">구독 기간</p><p className="mt-2 text-sm text-[#76566b]">{formatDate(billing.subscription.currentPeriodStart)} - {formatDate(billing.subscription.currentPeriodEnd)}</p></div>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <UsageBar label="이번 달 텍스트 사용량" used={billing.usage.textMessages} limit={billing.plan.monthlyTextMessages} />
            <UsageBar label="이번 달 음성 사용량" used={billing.usage.voiceMinutes} limit={billing.plan.monthlyVoiceMinutes} />
          </div>
        </section>

        <section className="mt-8">
          <BillingPlans currentPlanCode={billing.plan.code} />
        </section>
      </section>
    </main>
  );
}

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return <LoginRequired />;

  let billing: BillingStatus;
  try {
    billing = await getBillingStatusForUser(session.user.email, session.user.name);
  } catch (error) {
    console.error("[billing][page]", error);
    return <SetupRequired />;
  }

  return <BillingDashboard billing={billing} />;
}
