import StartButton from "./_components/StartButton";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#10111a] text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm font-semibold text-indigo-300">
          Discord Anime AI
        </p>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          디스코드에서 만나는
          <br />
          AI 캐릭터 음성 대화
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
          한국어 AI 캐릭터와 텍스트 채팅, 음성 채팅을 함께 사용할 수 있는
          Discord 봇 서비스입니다.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <StartButton />

          <a
            href="#"
            className="rounded-xl border border-zinc-600 px-6 py-3 font-semibold text-zinc-100 hover:bg-zinc-800"
          >
            봇 초대하기
          </a>
        </div>

        <div className="mt-16 grid w-full gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left">
            <h2 className="text-xl font-bold">캐릭터 선택</h2>
            <p className="mt-3 text-zinc-400">
              서버마다 기본 AI 캐릭터를 선택하고 말투와 목소리를 설정합니다.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left">
            <h2 className="text-xl font-bold">음성 채팅</h2>
            <p className="mt-3 text-zinc-400">
              음성 채널에서 AI 캐릭터가 사용자의 말을 듣고 목소리로 답합니다.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left">
            <h2 className="text-xl font-bold">기억 관리</h2>
            <p className="mt-3 text-zinc-400">
              사용자 동의 기반으로 대화 기억을 켜고, 조회하고, 삭제할 수 있습니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
