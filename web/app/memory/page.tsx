const memories = [
  { id: "1", content: "사용자는 루나 캐릭터를 선호합니다." },
  { id: "2", content: "사용자는 짧고 자연스러운 답변을 좋아합니다." },
];

export default function MemoryPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <section className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">기억 관리</h1>
        <p className="mt-4 text-zinc-400">
          저장된 기억을 확인하고 삭제할 수 있습니다.
        </p>

        <div className="mt-8 space-y-4">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#202020] p-5"
            >
              <p>{memory.content}</p>
              <button className="rounded-full border border-red-400 px-4 py-2 text-sm text-red-300">
                삭제
              </button>
            </div>
          ))}
        </div>

        <button className="mt-8 rounded-full bg-red-500 px-6 py-3 font-semibold">
          전체 기억 삭제
        </button>
      </section>
    </main>
  );
}