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
    <main className="min-h-screen bg-[#070506] px-6 py-12 text-white">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-rose-100/15 bg-[#1b171d]/95 shadow-2xl shadow-pink-950/20">
        <div className="border-b border-rose-100/10 bg-gradient-to-r from-rose-500/12 via-fuchsia-500/8 to-indigo-500/10 px-8 py-7">
          <p className="text-sm font-bold text-rose-200">Discord Anime AI</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-normal">
            회원가입
          </h1>
          <p className="mt-4 leading-7 text-zinc-300">
            Google 계정으로 로그인되었습니다. 서비스에서 사용할 이름, AI가 불러줄 닉네임, 기본 가입 정보를 입력해주세요.
          </p>
        </div>

        <div className="px-8 pb-8">
          <ProfileForm
            initialDisplayName={profile?.displayName ?? session.user.name ?? ""}
            initialNickname={profile?.nickname ?? ""}
            initialGender={profile?.gender ?? null}
            initialBirthDate={profile?.birthDate ?? null}
          />
        </div>
      </section>
    </main>
  );
}
