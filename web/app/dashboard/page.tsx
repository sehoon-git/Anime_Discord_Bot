import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { getBillingStatusForUser } from "@/app/lib/billing";
import { CreditPanel } from "@/app/_components/BillingPlans";
import AutoGoogleSignIn from "@/app/_components/AutoGoogleSignIn";
import DashboardOnboarding from "@/app/_components/DashboardOnboarding";
import { listMemories } from "@/app/lib/memory";
import { getUserProfileByEmail, hasCompleteProfile } from "@/app/lib/users";
import { getMessages, toAppLocale } from "@/app/i18n/messages";

type DiscordAccountRow = {
  discord_user_id: string;
  discord_username: string | null;
  discord_global_name: string | null;
};

const REQUIRED_CONSENTS = ["terms", "privacy", "overseas", "memory", "voice", "security_ip"];

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  return `${code} ${message}`.trim();
}

function dashboardErrorMessage(error: unknown, fallback: string) {
  const text = errorText(error);

  if (
    text.includes("DATABASE_URL") ||
    text.includes("ECONN") ||
    text.includes("ENOTFOUND") ||
    text.toLowerCase().includes("timeout")
  ) {
    return "데이터베이스 연결에 실패했습니다. Vercel Environment Variables의 DATABASE_URL 또는 WEB_DATABASE_URL이 현재 Neon DB 주소인지 확인해주세요.";
  }

  if (text.includes("user_accounts") || text.includes("42P01")) {
    return "Discord 연동 테이블(user_accounts)을 찾지 못했습니다. Neon SQL Editor에서 user_accounts 생성 SQL을 실행했는지 확인해주세요.";
  }

  if (text.includes("user_consents") || text.includes("users")) {
    return "동의/사용자 테이블을 읽는 중 오류가 발생했습니다. Neon에 users, user_consents 테이블이 있는지 확인해주세요.";
  }

  return fallback;
}

function DashboardError({
  title,
  message,
  backHome = "Back to home",
}: {
  title: string;
  message: string;
  backHome?: string;
}) {
  return (
    <main className="site-wash min-h-screen px-6 py-12 text-[#493647]">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#f0d4e2] bg-white/85 p-6 shadow-[0_20px_60px_rgba(198,135,169,0.16)]">
        <p className="text-sm font-semibold text-[#d45d91]">Voice With AI</p>
        <h1 className="mt-3 text-3xl font-bold text-[#5b4054]">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-[#a44b67]">{message}</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-2xl bg-[#e97eab] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d96798]"
        >
          {backHome}
        </Link>
      </section>
    </main>
  );
}

export default async function DashboardPage() {
  const locale = toAppLocale((await cookies()).get("locale")?.value);
  const initialMessages = getMessages(locale);
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return <AutoGoogleSignIn callbackUrl="/dashboard" locale={locale} />;
  }

  const userEmail = session.user.email;

  if (!userEmail) {
    return (
      <DashboardError
        title="이메일 확인 필요"
        message="Google 계정에서 이메일 정보를 읽지 못했습니다. 다른 Google 계정으로 다시 로그인해보세요."
        backHome={initialMessages.dashboard.backHome}
      />
    );
  }

  let acceptedCount = 0;

  try {
    const consent = await db.query<{ accepted_count: number }>(
      `
      SELECT COUNT(DISTINCT user_consents.consent_type)::int AS accepted_count
      FROM user_consents
      JOIN users ON users.id = user_consents.user_id
      WHERE users.email = $1
        AND user_consents.consent_type = ANY($2::text[])
        AND user_consents.accepted_at IS NOT NULL
      `,
      [userEmail, REQUIRED_CONSENTS],
    );

    acceptedCount = consent.rows[0]?.accepted_count ?? 0;
  } catch (error) {
    console.error("[dashboard][consent]", error);

    return (
      <DashboardError
        title="동의 정보 확인 실패"
        message={dashboardErrorMessage(
          error,
          "동의 정보를 확인하는 중 서버 오류가 발생했습니다. Vercel Logs에서 dashboard 오류를 확인해주세요.",
        )}
        backHome={initialMessages.dashboard.backHome}
      />
    );
  }

  const profile = await getUserProfileByEmail(userEmail);

  if (!profile || !hasCompleteProfile(profile)) {
    redirect("/profile");
  }

  if (acceptedCount < REQUIRED_CONSENTS.length) {
    redirect("/consent");
  }

  let discordAccount: DiscordAccountRow | undefined;
  let discordLookupError: string | null = null;

  try {
    const account = await db.query<DiscordAccountRow>(
      `
      SELECT
        provider_user_id AS discord_user_id,
        username AS discord_username,
        global_name AS discord_global_name
      FROM user_accounts
      JOIN users ON users.id = user_accounts.user_id
      WHERE users.email = $1
        AND user_accounts.provider = 'discord'
      LIMIT 1
      `,
      [userEmail],
    );

    discordAccount = account.rows[0];
  } catch (error) {
    console.error("[dashboard][discord-account]", error);
    discordLookupError = dashboardErrorMessage(
      error,
      "Discord 연동 정보를 읽는 중 오류가 발생했습니다. Vercel Logs에서 Discord 계정 조회 오류를 확인해주세요.",
    );
  }

  const discordName =
    discordAccount?.discord_global_name ??
    discordAccount?.discord_username ??
    null;
  const t = getMessages(profile.locale);

  let overview = {
    planName: "Free",
    textUsage: 0,
    textLimit: 0,
    voiceUsage: 0,
    voiceLimit: 0,
    memoryCount: 0,
  };

  try {
    const billing = await getBillingStatusForUser(userEmail, session.user.name);
    const memories = await listMemories(billing.userId);
    overview = {
      planName: billing.plan.name,
      textUsage: billing.usage.textMessages,
      textLimit: billing.plan.monthlyTextMessages,
      voiceUsage: billing.usage.voiceMinutes,
      voiceLimit: billing.plan.monthlyVoiceMinutes,
      memoryCount: memories.length,
    };
  } catch (error) {
    console.error("[dashboard][overview]", error);
  }

  return (
    <main className="site-wash min-h-screen px-6 py-7 text-[#493647] sm:py-8">
      <section className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#d45d91]">Voice With AI</p>
            <h1 className="mt-2 text-4xl font-bold">{t.dashboard.title}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
            <p className="text-sm text-[#806579]">
              {t.dashboard.signedIn(profile.nickname ?? session.user.name ?? userEmail)}
            </p>
            <DashboardOnboarding
              userId={profile.userId}
              locale={profile.locale}
              discordLinked={Boolean(discordName)}
              className="shrink-0"
            />
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.12)]">
          <h2 className="text-lg font-semibold">{t.dashboard.discordTitle}</h2>

          {discordName ? (
            <p className="mt-2 text-sm text-[#92768a]">
              {t.dashboard.linked(discordName)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#92768a]">
              {t.dashboard.unlinked}
            </p>
          )}

          {discordLookupError ? (
            <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-200">
              {discordLookupError}
            </p>
          ) : null}

          <a
            href="/api/discord/connect"
            target="_blank"
            rel="noopener noreferrer"
            className="discord-connect-button mt-4 inline-flex items-center rounded-full px-6 py-3 text-sm font-extrabold shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            {discordName ? t.dashboard.reconnect : t.dashboard.connect}
          </a>

          {discordName ? (
            <a
              href="/api/discord/bot-invite"
              className="discord-invite-button ml-3 mt-4 inline-flex items-center rounded-full px-6 py-3 text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              {t.dashboard.invite}
            </a>
          ) : null}
        </div>

        <section className="mt-4 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">{t.dashboard.overviewTitle}</h2><p className="mt-1 text-sm text-[#92768a]">{t.dashboard.overviewDescription}</p></div>
            <Link href="/billing" className="rounded-full border border-[#e3bfd3] px-4 py-2 text-sm font-semibold text-[#76566b] transition hover:-translate-y-0.5 hover:bg-white hover:text-[#d45d91]">{t.dashboard.viewPlans} →</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/billing" className="rounded-2xl border border-[#efd8e5] bg-white/60 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"><p className="text-xs font-semibold text-[#a4577e]">{t.dashboard.currentPlan}</p><p className="mt-2 text-xl font-extrabold">{overview.planName}</p><p className="mt-1 text-sm text-[#92768a]">{t.dashboard.managePlan} →</p></Link>
            <Link href="/memory" className="rounded-2xl border border-[#efd8e5] bg-white/60 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"><p className="text-xs font-semibold text-[#a4577e]">{t.dashboard.savedMemories}</p><p className="mt-2 text-xl font-extrabold">{t.dashboard.count(overview.memoryCount)}</p><p className="mt-1 text-sm text-[#92768a]">{t.dashboard.manageMemories} →</p></Link>
          </div>
        </section>

        <div className="mt-4"><CreditPanel locale={profile.locale} /></div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <a
            href="/profile"
            className="rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)] hover:bg-white"
          >
            <h2 className="text-lg font-semibold">{t.dashboard.profile}</h2>
            <p className="mt-3 text-sm text-zinc-400">
              {t.dashboard.profileDescription}
            </p>
          </a>

          <a
            href="/settings/privacy"
            className="rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)] hover:bg-white"
          >
            <h2 className="text-lg font-semibold">{t.dashboard.voiceSettings}</h2>
            <p className="mt-3 text-sm text-zinc-400">
              {t.dashboard.voiceSettingsDescription}
            </p>
          </a>

          <a
            href="/support"
            className="rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)] hover:bg-white"
          >
            <h2 className="text-lg font-semibold">{t.dashboard.support}</h2>
            <p className="mt-3 text-sm text-zinc-400">
              {t.dashboard.supportDescription}
            </p>
          </a>
        </div>
      </section>
    </main>
  );
}
