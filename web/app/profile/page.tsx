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
    <main className="site-wash min-h-screen px-6 py-12 text-[#493647]">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-[30px] border border-[#efd4e2] bg-white/88 shadow-[0_24px_70px_rgba(198,135,169,0.2)]">
        <div className="border-b border-[#f1dce7] bg-gradient-to-br from-[#fff0f7] via-white to-[#f2efff] px-8 py-7">
          <p className="text-sm font-bold text-[#d45d91]">Discord Anime AI</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-normal text-[#5b4054]">
            회원가입
          </h1>
          <p className="mt-4 leading-7 text-[#806579]">
            Google 계정으로 로그인되었습니다. 서비스에서 사용할 이름, AI가 불러줄 닉네임, 기본 가입 정보를 입력해주세요.
          </p>
        </div>

        <div className="px-8 pb-8">
          <ProfileForm
            initialDisplayName={profile?.displayName ?? session.user.name ?? ""}
            initialNickname={profile?.nickname ?? ""}
            initialGender={profile?.gender ?? null}
            initialBirthDate={profile?.birthDate ?? null}
            initialPhoneNumber={profile?.phoneNumber ?? ""}
            initialPhoneVerified={profile?.phoneVerified ?? false}
            initialLocale={profile?.locale ?? "en-US"}
          />
        </div>
      </section>
    </main>
  );
}
