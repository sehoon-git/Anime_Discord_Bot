import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";

type DiscordAccountRow = {
  discord_user_id: string;
  discord_username: string | null;
  discord_global_name: string | null;
};

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
    return "데이터베이스 연결에 실패했습니다. Vercel Environment Variables의 DATABASE_URL이 현재 Neon DB 주소인지 확인해주세요.";
  }

  if (text.includes("user_accounts") || text.includes("42P01")) {
    return "Discord 연동 테이블(user_accounts)을 찾지 못했습니다. Neon SQL Editor에서 user_accounts 생성 SQL을 실행했는지 확인해주세요.";
  }

  if (text.includes("user_consents") || text.includes("users")) {
    return "동의/사용자 테이블을 읽는 중 오류가 났습니다. Neon에 users, user_consents 테이블이 있는지 확인해주세요.";
  }

  return fallback;
}

function DashboardError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <section className="mx-auto max-w-3xl rounded-xl border border-red-900/50 bg-[#202020] p-6">
        <p className="text-sm font-semibold text-indigo-300">
          Discord Anime AI
        </p>
        <h1 className="mt-3 text-3xl font-bold">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-red-200">{message}</p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          홈으로 돌아가기
        </a>
      </section>
    </main>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/api/auth/signin/google?callbackUrl=/dashboard");
  }

  const userEmail = session.user.email;

  if (!userEmail) {
    return (
      <DashboardError
        title="이메일 확인 필요"
        message="Google 계정에서 이메일 정보를 읽지 못했습니다. 다른 Google 계정으로 다시 로그인해보세요."
      />
    );
  }

  let acceptedCount = 0;

  try {
    const consent = await db.query<{ accepted_count: number }>(
      `
      SELECT COUNT(*)::int AS accepted_count
      FROM user_consents
      JOIN users ON users.id = user_consents.user_id
      WHERE users.email = $1
        AND user_consents.consent_type IN ('terms', 'privacy', 'overseas')
      `,
      [userEmail],
    );

    acceptedCount = consent.rows[0]?.accepted_count ?? 0;
  } catch (error) {
    console.error("[dashboard][consent]", error);

    return (
      <DashboardError
        title="동의 정보 확인 실패"
        message={dashboardErrorMessage(
          error,
          "동의 정보를 확인하는 중 서버 오류가 났습니다. Vercel Logs에서 dashboard 오류를 확인해주세요.",
        )}
      />
    );
  }

  if (acceptedCount < 3) {
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
      "Discord 연동 정보를 읽는 중 오류가 났습니다. Vercel Logs에서 Discord 계정 조회 오류를 확인해주세요.",
    );
  }

  const discordName =
    discordAccount?.discord_global_name ??
    discordAccount?.discord_username ??
    null;

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-indigo-300">
          Discord Anime AI
        </p>
        <h1 className="mt-3 text-4xl font-bold">대시보드</h1>
        <p className="mt-4 text-zinc-400">
          {session.user.name ?? userEmail} 계정으로 로그인되었습니다.
        </p>

        <div className="mt-8 rounded-xl border border-zinc-800 bg-[#202020] p-5">
          <h2 className="text-lg font-semibold">Discord 계정 연동</h2>

          {discordName ? (
            <p className="mt-2 text-sm text-zinc-400">
              {discordName} 계정과 연결되었습니다.
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">
              봇 사용 권한을 확인하려면 Discord 계정을 연결해야 합니다.
            </p>
          )}

          {discordLookupError ? (
            <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-200">
              {discordLookupError}
            </p>
          ) : null}

          <a
            href="/api/discord/connect"
            className="mt-4 inline-flex rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            {discordName ? "Discord 계정 다시 연결하기" : "Discord 계정 연결하기"}
          </a>

          {discordName ? (
            <a
              href="/api/discord/bot-invite"
              className="ml-3 mt-4 inline-flex rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-900"
            >
              봇 초대하기
            </a>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <a
            href="/billing"
            className="rounded-xl border border-zinc-800 bg-[#202020] p-5 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">요금제</h2>
            <p className="mt-3 text-sm text-zinc-400">
              구독 플랜과 결제 수단을 확인합니다.
            </p>
          </a>

          <a
            href="/memory"
            className="rounded-xl border border-zinc-800 bg-[#202020] p-5 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">기억 관리</h2>
            <p className="mt-3 text-sm text-zinc-400">
              저장된 장기기억을 조회하고 삭제합니다.
            </p>
          </a>

          <a
            href="/settings/privacy"
            className="rounded-xl border border-zinc-800 bg-[#202020] p-5 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">개인정보 설정</h2>
            <p className="mt-3 text-sm text-zinc-400">
              음성 처리와 국외 이전 동의를 관리합니다.
            </p>
          </a>
        </div>
      </section>
    </main>
  );
}
