import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ProfileForm from "@/app/_components/ProfileForm";
import { authOptions } from "@/app/lib/auth";
import { getUserProfileByEmail, hasCompleteProfile } from "@/app/lib/users";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/api/auth/signin/google?callbackUrl=/profile");
  const profile = await getUserProfileByEmail(session.user.email);
  if (hasCompleteProfile(profile)) redirect("/dashboard");
  const locale = (await cookies()).get("locale")?.value === "ko-KR" || profile?.locale === "ko-KR" ? "ko-KR" : "en-US";
  const ko = locale === "ko-KR";
  return <main className="site-wash min-h-screen px-6 py-12 text-[#493647]"><section className="mx-auto max-w-2xl overflow-hidden rounded-[30px] border border-[#efd4e2] bg-white/88 shadow-[0_24px_70px_rgba(198,135,169,0.2)]"><div className="border-b border-[#f1dce7] bg-gradient-to-br from-[#fff0f7] via-white to-[#f2efff] px-8 py-7"><p className="text-sm font-bold text-[#d45d91]">VoiceWithAI</p><h1 className="mt-3 text-3xl font-extrabold text-[#5b4054]">{ko ? "회원가입" : "Create your account"}</h1><p className="mt-4 leading-7 text-[#806579]">{ko ? "Google 계정으로 로그인되었습니다. 서비스에서 사용할 이름, AI가 불러줄 닉네임, 기본 가입 정보를 입력해주세요." : "You are signed in with Google. Enter the name you will use in the service, the nickname the AI will call you, and your basic profile information."}</p></div><div className="px-8 pb-8"><ProfileForm initialDisplayName={profile?.displayName ?? session.user.name ?? ""} initialNickname={profile?.nickname ?? ""} initialGender={profile?.gender ?? null} initialBirthDate={profile?.birthDate ?? null} initialLocale={locale} /></div></section></main>;
}
