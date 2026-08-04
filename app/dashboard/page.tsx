import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/api/auth/signin/google?callbackUrl=/dashboard");
  }

  const consent = await db.query(
    "SELECT id FROM user_consents WHERE email = $1 LIMIT 1",
    [session.user.email],
  );

  if ((consent.rowCount ?? 0) === 0) {
    redirect("/consent");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-indigo-300">
          Discord Anime AI
        </p>
        <h1 className="mt-3 text-4xl font-bold">대시보드</h1>
        <p className="mt-4 text-zinc-400">
          {session.user.name ?? session.user.email} 계정으로 로그인되었습니다.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <a
            href="/billing"
            className="rounded-xl border border-zinc-800 bg-[#202020] p-5 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">요금제</h2>
            <p className="mt-2 text-sm text-zinc-400">
              구독 플랜과 결제 수단을 확인합니다.
            </p>
          </a>
          <a
            href="/memory"
            className="rounded-xl border border-zinc-800 bg-[#202020] p-5 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">기억 관리</h2>
            <p className="mt-2 text-sm text-zinc-400">
              저장된 장기기억을 조회하고 삭제합니다.
            </p>
          </a>
          <a
            href="/settings/privacy"
            className="rounded-xl border border-zinc-800 bg-[#202020] p-5 hover:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">개인정보 설정</h2>
            <p className="mt-2 text-sm text-zinc-400">
              음성 처리와 국외 이전 동의를 관리합니다.
            </p>
          </a>
        </div>
      </section>
    </main>
  );
}
