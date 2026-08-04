import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth";
import { deleteAllMemories, deleteMemory, listMemories } from "@/app/lib/memory";
import { upsertUser } from "@/app/lib/users";

export const dynamic = "force-dynamic";

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return null;
  }

  return upsertUser(email, session.user?.name ?? null);
}

async function deleteOneMemory(formData: FormData) {
  "use server";

  const userId = await getCurrentUserId();
  const memoryId = String(formData.get("memoryId") ?? "");

  if (!userId || !memoryId) {
    return;
  }

  await deleteMemory(userId, memoryId);
  revalidatePath("/memory");
}

async function deleteEveryMemory() {
  "use server";

  const userId = await getCurrentUserId();

  if (!userId) {
    return;
  }

  await deleteAllMemories(userId);
  revalidatePath("/memory");
}

export default async function MemoryPage() {
  const userId = await getCurrentUserId();
  const memories = userId ? await listMemories(userId) : [];

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl">
        <p className="mb-3 text-sm font-semibold text-indigo-400">
          Discord Anime AI
        </p>
        <h1 className="text-4xl font-bold">기억 관리</h1>
        <p className="mt-4 text-slate-300">
          장기기억 동의 후 저장된 기억을 확인하고 삭제할 수 있습니다.
        </p>

        <div className="mt-10 space-y-4">
          {memories.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/10 p-6 text-slate-300">
              아직 저장된 장기기억이 없습니다.
            </div>
          ) : (
            memories.map((memory) => (
              <div
                key={memory.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/10 p-5"
              >
                <div>
                  <p className="font-semibold">{memory.content}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {new Date(memory.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <form action={deleteOneMemory}>
                  <input type="hidden" name="memoryId" value={memory.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-red-400 px-5 py-2 font-semibold text-red-300 transition hover:bg-red-500 hover:text-white"
                  >
                    삭제
                  </button>
                </form>
              </div>
            ))
          )}
        </div>

        {memories.length > 0 ? (
          <form action={deleteEveryMemory} className="mt-8">
            <button
              type="submit"
              className="rounded-full bg-red-500 px-6 py-3 font-bold text-white transition hover:bg-red-600"
            >
              전체 기억 삭제
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
