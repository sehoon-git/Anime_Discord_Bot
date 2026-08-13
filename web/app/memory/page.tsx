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
  if (!session?.user?.email) return <AutoGoogleSignIn callbackUrl="/memory" />;

  const userId = await upsertUser(session.user.email, session.user.name ?? null);
  if ((await getMissingRequiredConsents(userId)).length > 0) redirect("/profile");

  const memories = await listMemories(userId);
  const ko = (await cookies()).get("locale")?.value === "ko-KR";
  const copy = ko
    ? {
        title: "기억 관리", intro: "캐릭터가 더 자연스럽게 대화할 수 있도록 저장된 장기기억을 확인하고 관리하세요.", count: "저장된 기억",
        emptyTitle: "아직 저장된 기억이 없어요", emptyText: "셀린과 대화를 이어가면, 대화에 도움이 되는 내용을 장기기억으로 저장해 다음 만남에도 자연스럽게 이어갈 수 있어요.",
        character: "캐릭터 설정 보기 →", savedTitle: "저장된 기억", savedText: "중요한 기억은 고정하고, 원하지 않는 내용은 언제든 삭제할 수 있어요.",
        keeping: "개 보관 중", confidence: "신뢰도", pin: "고정", unpin: "고정 해제", remove: "삭제", clear: "전체 기억 삭제",
        tips: [["✦", "대화가 이어져요", "저장된 기억은 다음 대화에서 캐릭터가 맥락을 이해하는 데 도움을 줍니다."], ["📌", "중요한 기억 고정", "꼭 유지하고 싶은 내용은 고정해 한눈에 확인할 수 있어요."], ["⌁", "내가 직접 관리", "필요 없는 기억은 이 페이지에서 언제든 삭제할 수 있어요."]],
      }
    : {
        title: "Memory", intro: "Review and manage long-term memories to make character conversations feel more natural.", count: "Saved memories",
        emptyTitle: "No memories saved yet", emptyText: "As you continue conversations with Seline, helpful details can be saved as long-term memories for more natural future chats.",
        character: "View character settings →", savedTitle: "Saved memories", savedText: "Pin important memories and delete anything you no longer want saved.",
        keeping: " saved", confidence: "Confidence", pin: "Pin", unpin: "Unpin", remove: "Delete", clear: "Delete all memories",
        tips: [["✦", "Conversations continue", "Saved memories help your character understand the context in future conversations."], ["📌", "Pin important memories", "Pin the details you want to keep visible and easy to review."], ["⌁", "You stay in control", "You can remove memories you no longer need at any time."]],
      };

  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]">
    <section className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="mb-3 text-sm font-semibold text-[#d45d91]">VoiceWithAI</p><h1 className="text-4xl font-bold">{copy.title}</h1><p className="mt-4 max-w-2xl text-[#806579]">{copy.intro}</p></div>
        <div className="rounded-2xl border border-[#efd8e5] bg-white/75 px-5 py-4 text-right shadow-[0_12px_30px_rgba(198,135,169,0.1)]"><p className="text-xs font-semibold text-[#a4577e]">{copy.count}</p><p className="mt-1 text-2xl font-extrabold">{memories.length}<span className="ml-1 text-sm font-semibold text-[#92768a]">{ko ? "개" : "items"}</span></p></div>
      </div>
      <section className="mt-10 rounded-3xl border border-[#f0d7e5] bg-white/80 p-6 shadow-[0_16px_45px_rgba(198,135,169,0.12)]">
        {memories.length === 0 ? <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]"><div><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ef8fba] to-[#a895f4] text-2xl text-white shadow-lg">✦</span><h2 className="mt-5 text-xl font-extrabold">{copy.emptyTitle}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#92768a]">{copy.emptyText}</p></div><Link href="/characters" className="inline-flex rounded-full bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5">{copy.character}</Link></div> : <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">{copy.savedTitle}</h2><p className="mt-1 text-sm text-[#92768a]">{copy.savedText}</p></div><span className="rounded-full bg-[#fff0f7] px-3 py-1.5 text-sm font-bold text-[#d45d91]">{ko ? `${memories.length}${copy.keeping}` : `${memories.length}${copy.keeping}`}</span></div><div className="mt-6 space-y-3">{memories.map((memory) => <article key={memory.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[#efd8e5] bg-[#fffafd]/70 p-5 sm:flex-row sm:items-center"><div><p className="font-semibold">{memory.isPinned ? "📌 " : ""}{memory.content}</p><p className="mt-2 text-sm text-[#92768a]">{copy.confidence} {Math.round(memory.confidence * 100)}% · {new Date(memory.createdAt).toLocaleString(ko ? "ko-KR" : "en-US")}</p></div><div className="flex shrink-0 gap-2"><form action={toggleMemoryPin}><input type="hidden" name="memoryId" value={memory.id} /><input type="hidden" name="pinned" value={String(!memory.isPinned)} /><button type="submit" className="rounded-full border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-700 transition hover:bg-pink-100">{memory.isPinned ? copy.unpin : copy.pin}</button></form><form action={deleteOneMemory}><input type="hidden" name="memoryId" value={memory.id} /><button type="submit" className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">{copy.remove}</button></form></div></article>)}</div><form action={deleteEveryMemory} className="mt-6 border-t border-[#f0d7e5] pt-5"><button type="submit" className="rounded-full bg-red-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-600">{copy.clear}</button></form></>}
      </section>
      <section className="mt-5 grid gap-4 md:grid-cols-3">{copy.tips.map(([icon, title, description]) => <article key={title} className="rounded-3xl border border-[#f0d7e5] bg-white/65 p-5 shadow-[0_12px_30px_rgba(198,135,169,0.08)]"><span className="text-lg">{icon}</span><h2 className="mt-3 font-extrabold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#92768a]">{description}</p></article>)}</section>
    </section>
  </main>;
}
