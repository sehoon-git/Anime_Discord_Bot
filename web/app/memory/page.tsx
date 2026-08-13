import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/lib/auth";
import AutoGoogleSignIn from "@/app/_components/AutoGoogleSignIn";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { deleteAllMemories, deleteMemory, listMemories, setMemoryPinned } from "@/app/lib/memory";
import { upsertUser } from "@/app/lib/users";

export const dynamic = "force-dynamic";
async function getCurrentUserId() { const session = await getServerSession(authOptions); return session?.user?.email ? upsertUser(session.user.email, session.user.name ?? null) : null; }
async function deleteOneMemory(formData: FormData) { "use server"; const userId = await getCurrentUserId(); const memoryId = String(formData.get("memoryId") ?? ""); if (userId && memoryId) { await deleteMemory(userId, memoryId); revalidatePath("/memory"); } }
async function deleteEveryMemory() { "use server"; const userId = await getCurrentUserId(); if (userId) { await deleteAllMemories(userId); revalidatePath("/memory"); } }
async function toggleMemoryPin(formData: FormData) { "use server"; const userId = await getCurrentUserId(); const memoryId = String(formData.get("memoryId") ?? ""); if (userId && memoryId) { await setMemoryPinned(userId, memoryId, formData.get("pinned") === "true"); revalidatePath("/memory"); } }

export default async function MemoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return <AutoGoogleSignIn callbackUrl="/memory" />;
  }

  const userId = await upsertUser(session.user.email, session.user.name ?? null);
  if (userId && (await getMissingRequiredConsents(userId)).length > 0) redirect("/profile");
  const memories = userId ? await listMemories(userId) : []; const ko = (await cookies()).get("locale")?.value === "ko-KR";
  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-4xl"><p className="mb-3 text-sm font-semibold text-[#d45d91]">Discord Anime AI</p><h1 className="text-4xl font-bold">{ko ? "기억 관리" : "Memory"}</h1><p className="mt-4 text-[#806579]">{ko ? "저장된 장기기억을 확인하고 고정하거나 삭제할 수 있습니다." : "Review, pin, or delete your saved long-term memories."}</p><div className="mt-10 space-y-4">{memories.length === 0 ? <div className="rounded-2xl border border-[#f0d7e5] bg-white/70 p-6 text-[#806579]">{ko ? "저장된 장기기억이 없습니다." : "No saved memories yet."}</div> : memories.map((memory) => <div key={memory.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[#f0d7e5] bg-white/70 p-5"><div><p className="font-semibold">{memory.isPinned ? "♥ " : ""}{memory.content}</p><p className="mt-2 text-sm text-[#92768a]">{ko ? "신뢰도" : "Confidence"} {Math.round(memory.confidence * 100)}% · {new Date(memory.createdAt).toLocaleString(ko ? "ko-KR" : "en-US")}</p></div><div className="flex shrink-0 gap-2"><form action={toggleMemoryPin}><input type="hidden" name="memoryId" value={memory.id} /><input type="hidden" name="pinned" value={String(!memory.isPinned)} /><button type="submit" className="rounded-full border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-700 hover:bg-pink-100">{memory.isPinned ? (ko ? "고정 해제" : "Unpin") : (ko ? "고정" : "Pin")}</button></form><form action={deleteOneMemory}><input type="hidden" name="memoryId" value={memory.id} /><button type="submit" className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">{ko ? "삭제" : "Delete"}</button></form></div></div>)}</div>{memories.length > 0 ? <form action={deleteEveryMemory} className="mt-8"><button type="submit" className="rounded-full bg-red-500 px-6 py-3 font-bold text-white hover:bg-red-600">{ko ? "전체 기억 삭제" : "Delete all memories"}</button></form> : null}</section></main>;
}
