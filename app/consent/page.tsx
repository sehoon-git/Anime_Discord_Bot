"use client";

import { useEffect } from "react";
import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ConsentPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [overseas, setOverseas] = useState(false);
  const [voice, setVoice] = useState(false);
  const [memory, setMemory] = useState(false);

  const canContinue = terms && privacy && overseas;

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google", { callbackUrl: "/consent" });
    }
  }, [status]);

  function handleContinue() {
    if (!canContinue || !session?.user) {
      return;
    }

    localStorage.setItem("discord-anime-ai-consent", "accepted");
    localStorage.setItem(
      "discord-anime-ai-consent-detail",
      JSON.stringify({
        accepted: true,
        acceptedAt: new Date().toISOString(),
        email: session.user.email,
        terms,
        privacy,
        overseas,
        voice,
        memory,
      }),
    );
    router.push("/dashboard");
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-black px-6 py-12 text-white">
        <section className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-[#202020] p-8">
          <p className="text-zinc-400">로그인 상태를 확인 중입니다.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <section className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-[#202020] p-8">
        <h1 className="text-3xl font-bold">서비스 이용 동의</h1>
        <p className="mt-3 text-zinc-400">
          Discord Anime AI 사용을 위해 필요한 항목에 동의해주세요.
        </p>

        <div className="mt-8 space-y-4">
          <label className="block">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
            />
            <span className="ml-3">[필수] 이용약관 동의</span>
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={privacy}
              onChange={(e) => setPrivacy(e.target.checked)}
            />
            <span className="ml-3">[필수] 개인정보 수집 및 이용 동의</span>
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={overseas}
              onChange={(e) => setOverseas(e.target.checked)}
            />
            <span className="ml-3">[필수] 개인정보 국외 이전 동의</span>
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={voice}
              onChange={(e) => setVoice(e.target.checked)}
            />
            <span className="ml-3">[선택] 음성 데이터 처리 동의</span>
          </label>

          <label className="block">
            <input
              type="checkbox"
              checked={memory}
              onChange={(e) => setMemory(e.target.checked)}
            />
            <span className="ml-3">[선택] 장기기억 저장 동의</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="mt-8 w-full rounded-full bg-blue-500 py-3 font-semibold disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          동의하고 시작하기
        </button>
      </section>
    </main>
  );
}
