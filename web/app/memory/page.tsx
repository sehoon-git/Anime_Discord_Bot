import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import AutoGoogleSignIn from "@/app/_components/AutoGoogleSignIn";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { deleteAllMemories, deleteMemory, listMemories, setMemoryPinned } from "@/app/lib/memory";
import { upsertUser } from "@/app/lib/users";
import { getMessages, toAppLocale } from "@/app/i18n/messages";
import { getLongTermMemoryLimit } from "@/app/lib/billing";

export const dynamic = "force-dynamic";

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.email ? upsertUser(session.user.email, session.user.name ?? null) : null;
}

async function deleteOneMemory(formData: FormData) {
  "use server";
  const userId = await getCurrentUserId();
  const memoryId = String(formData.get("memoryId") ?? "");
  if (userId && memoryId) {
    await deleteMemory(userId, memoryId);
    revalidatePath("/memory");
  }
}

async function deleteEveryMemory() {
  "use server";
  const userId = await getCurrentUserId();
  if (userId) {
    await deleteAllMemories(userId);
    revalidatePath("/memory");
  }
}

async function toggleMemoryPin(formData: FormData) {
  "use server";
  const userId = await getCurrentUserId();
  const memoryId = String(formData.get("memoryId") ?? "");
  if (userId && memoryId) {
    await setMemoryPinned(userId, memoryId, formData.get("pinned") === "true");
    revalidatePath("/memory");
  }
}

export default async function MemoryPage() {
  const session = await getServerSession(authOptions);
  const locale = toAppLocale((await cookies()).get("locale")?.value);
  if (!session?.user?.email) return <AutoGoogleSignIn callbackUrl="/memory" locale={locale} />;

  const userId = await upsertUser(session.user.email, session.user.name ?? null);
  if ((await getMissingRequiredConsents(userId)).length > 0) redirect("/profile");

  const memories = await listMemories(userId);
  const memoryLimit = await getLongTermMemoryLimit(userId);
  const copy = getMessages(locale).memory;

  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]">
    <section className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="mb-3 text-sm font-semibold text-[#d45d91]">Voice With AI</p><h1 className="text-4xl font-bold">{copy.title}</h1><p className="mt-4 max-w-2xl text-[#806579]">{copy.intro}</p></div>
        <div className="rounded-2xl border border-[#efd8e5] bg-white/75 px-5 py-4 text-right shadow-[0_12px_30px_rgba(198,135,169,0.1)]"><p className="text-xs font-semibold text-[#a4577e]">{copy.count}</p><p className="mt-1 text-2xl font-extrabold">{copy.items(memories.length)} <span className="text-base text-[#a4577e]">/ {copy.items(memoryLimit)}</span></p></div>
      </div>
      <section className="mt-10 rounded-3xl border border-[#f0d7e5] bg-white/80 p-6 shadow-[0_16px_45px_rgba(198,135,169,0.12)]">
        {memories.length === 0 ? <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]"><div><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ef8fba] to-[#a895f4] text-2xl text-white shadow-lg">✦</span><h2 className="mt-5 text-xl font-extrabold">{copy.emptyTitle}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#92768a]">{copy.emptyText}</p></div><Link href="/characters" className="inline-flex rounded-full bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5">{copy.character} →</Link></div> : <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">{copy.savedTitle}</h2><p className="mt-1 text-sm text-[#92768a]">{copy.savedText}</p></div><span className="rounded-full bg-[#fff0f7] px-3 py-1.5 text-sm font-bold text-[#d45d91]">{copy.keeping(memories.length)} / {copy.items(memoryLimit)}</span></div><div className="mt-6 space-y-3">{memories.map((memory) => <article key={memory.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[#efd8e5] bg-[#fffafd]/70 p-5 sm:flex-row sm:items-center"><div><p className="font-semibold">{memory.isPinned ? "📌 " : ""}{memory.content}</p><p className="mt-2 text-sm text-[#92768a]">{copy.confidence} {Math.round(memory.confidence * 100)}% · {new Date(memory.createdAt).toLocaleString(locale)}</p></div><div className="flex shrink-0 gap-2"><form action={toggleMemoryPin}><input type="hidden" name="memoryId" value={memory.id} /><input type="hidden" name="pinned" value={String(!memory.isPinned)} /><button type="submit" className="rounded-full border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-700 transition hover:bg-pink-100">{memory.isPinned ? copy.unpin : copy.pin}</button></form><form action={deleteOneMemory}><input type="hidden" name="memoryId" value={memory.id} /><button type="submit" className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">{copy.remove}</button></form></div></article>)}</div><form action={deleteEveryMemory} className="mt-6 border-t border-[#f0d7e5] pt-5"><button type="submit" className="rounded-full bg-red-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-50">{copy.clear}</button></form></>}
      </section>
      <section className="mt-5 grid gap-4 md:grid-cols-3">{copy.tips.map(([icon, title, description]) => <article key={title} className="rounded-3xl border border-[#f0d7e5] bg-white/65 p-5 shadow-[0_12px_30px_rgba(198,135,169,0.08)]"><span className="text-lg">{icon}</span><h2 className="mt-3 font-extrabold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#92768a]">{description}</p></article>)}</section>
    </section>
  </main>;
}
