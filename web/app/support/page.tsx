import { cookies } from "next/headers";
import { getMessages, toAppLocale } from "@/app/i18n/messages";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import AutoGoogleSignIn from "@/app/_components/AutoGoogleSignIn";

export default async function SupportPage() {
  const locale = toAppLocale((await cookies()).get("locale")?.value);
  const copy = getMessages(locale).supportPage;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return <AutoGoogleSignIn callbackUrl="/support" locale={locale} />;
  }

  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-2xl rounded-3xl border border-[#f0d7e5] bg-white/80 p-8 text-center shadow-[0_20px_60px_rgba(198,135,169,0.16)]"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ef8fba] to-[#a895f4] text-2xl text-white shadow-lg shadow-pink-200/50">?</span><p className="mt-6 text-sm font-semibold text-[#d45d91]">Voice With AI</p><h1 className="mt-3 text-3xl font-extrabold text-[#5b4054]">{copy.title}</h1><p className="mt-5 leading-7 text-[#806579]">{copy.description}</p><p className="mt-3 text-sm text-[#92768a]">{copy.note}</p><a href="https://discord.gg/kvVXhdue2" target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex rounded-full border border-[#ef9fc2] bg-[#8f5f86] px-6 py-3 font-bold text-white shadow-[0_8px_20px_rgba(12,8,18,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#d879aa] hover:shadow-lg active:translate-y-0 active:scale-[0.98]">{copy.action} →</a></section></main>;
}
