import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import ProfileForm from "@/app/_components/ProfileForm";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import {
  getUserProfileByEmail,
  upsertUser,
} from "@/app/lib/users";

const REQUIRED_CONSENTS = ["terms", "privacy", "overseas", "memory"];

async function hasRequiredConsents(email: string) {
  const consent = await db.query<{ accepted_count: number }>(
    `
    SELECT COUNT(DISTINCT user_consents.consent_type)::int AS accepted_count
    FROM user_consents
    JOIN users ON users.id = user_consents.user_id
    WHERE users.email = $1
      AND user_consents.consent_type = ANY($2::text[])
    `,
    [email, REQUIRED_CONSENTS],
  );

  return (consent.rows[0]?.accepted_count ?? 0) === REQUIRED_CONSENTS.length;
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/api/auth/signin/google?callbackUrl=/profile");
  }

  const hasConsent = await hasRequiredConsents(session.user.email);

  if (!hasConsent) {
    redirect("/consent");
  }

  await upsertUser(session.user.email, session.user.name);
  const profile = await getUserProfileByEmail(session.user.email);

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-8">
        <p className="text-sm font-semibold text-indigo-400">Discord Anime AI</p>
        <h1 className="mt-3 text-3xl font-bold">
          캐릭터가 당신을 어떻게 부르면 좋을까요?
        </h1>
        <p className="mt-4 text-zinc-400">
          Google 계정으로 로그인되었습니다. 서비스에서 사용할 이름과 AI가 불러줄 닉네임을 정해주세요.
        </p>

        <ProfileForm
          initialDisplayName={profile?.displayName ?? session.user.name ?? ""}
          initialNickname={profile?.nickname ?? ""}
        />
      </section>
    </main>
  );
}
