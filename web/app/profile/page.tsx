import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import ProfileForm from "@/app/_components/ProfileForm";
import { authOptions } from "@/app/lib/auth";
import {
  getUserProfileByEmail,
  upsertUser,
} from "@/app/lib/users";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/api/auth/signin/google?callbackUrl=/profile");
  }

  await upsertUser(session.user.email, session.user.name);
  const profile = await getUserProfileByEmail(session.user.email);

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-8">
        <p className="text-sm font-semibold text-indigo-400">Discord Anime AI</p>
        <h1 className="mt-3 text-3xl font-bold">회원가입</h1>
        <p className="mt-4 text-zinc-400">
          Google 계정으로 로그인되었습니다. 서비스에서 사용할 이름, AI가 불러줄 닉네임, 기본 가입 정보를 입력해주세요.
        </p>

        <ProfileForm
          initialDisplayName={profile?.displayName ?? session.user.name ?? ""}
          initialNickname={profile?.nickname ?? ""}
          initialGender={profile?.gender ?? null}
          initialBirthDate={profile?.birthDate ?? null}
        />
      </section>
    </main>
  );
}
