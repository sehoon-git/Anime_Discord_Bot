import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import ConsentUpdateForm from "@/app/_components/ConsentUpdateForm";
import { authOptions } from "@/app/lib/auth";

export default async function ConsentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/api/auth/signin/google?callbackUrl=/consent");
  const cookieLocale = (await cookies()).get("locale")?.value;
  const locale = cookieLocale === "ko-KR" || cookieLocale === "ja-JP" ? cookieLocale : "en-US";
  const ko = locale === "ko-KR";
  const ja = locale === "ja-JP";
  return <main className="site-wash min-h-screen px-6 py-12 text-[#493647]"><section className="mx-auto max-w-2xl"><p className="text-sm font-semibold text-[#d45d91]">Voice With AI</p><h1 className="mt-3 text-4xl font-bold">{ko ? "필수 약관 확인" : ja ? "必須規約の確認" : "Required consent update"}</h1><p className="mt-4 leading-7 text-[#806579]">{ko ? "가입 정보는 그대로 유지됩니다. 계속 이용하려면 필수 약관을 확인해 주세요." : ja ? "登録情報は保持されます。利用を続けるには必須規約を確認してください。" : "Your account details are kept. Please review the required terms to continue."}</p><ConsentUpdateForm locale={locale} /></section></main>;
}
