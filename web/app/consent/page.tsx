"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type ConsentErrorResponse = {
  error?: string;
};

export default function ConsentPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [overseas, setOverseas] = useState(false);
  const [voice, setVoice] = useState(false);
  const [memory, setMemory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canContinue = terms && privacy && overseas;

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google", { callbackUrl: "/consent" });
    }
  }, [status]);

  async function handleContinue() {
    if (!canContinue || !session?.user) return;
    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms, privacy, overseas, voice, memory }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as ConsentErrorResponse | null;
        setErrorMessage(data?.error ?? "동의 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setErrorMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">로그인 상태를 확인하는 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-8">
        <p className="text-sm font-semibold text-indigo-400">Discord Anime AI</p>
        <h1 className="mt-3 text-4xl font-bold">서비스 이용 동의</h1>
        <p className="mt-4 text-zinc-300">
          Discord Anime AI 사용을 위해 필요한 항목에 동의해주세요.
        </p>

        <div className="mt-8 space-y-4">
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
            <span>[필수] 이용약관 동의</span>
          </label>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} />
            <span>[필수] 개인정보 수집 및 이용 동의</span>
          </label>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" checked={overseas} onChange={(event) => setOverseas(event.target.checked)} />
            <span>[필수] 개인정보 국외 이전 동의</span>
          </label>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" checked={voice} onChange={(event) => setVoice(event.target.checked)} />
            <span>[선택] 음성 데이터 처리 동의</span>
          </label>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" checked={memory} onChange={(event) => setMemory(event.target.checked)} />
            <span>[선택] 장기기억 저장 동의</span>
          </label>
        </div>

        <button
          type="button"
          disabled={!canContinue || isSaving}
          onClick={handleContinue}
          className="mt-8 w-full rounded-2xl bg-blue-500 px-6 py-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {isSaving ? "저장 중..." : "동의하고 시작하기"}
        </button>

        {errorMessage ? <p className="mt-5 text-sm font-semibold text-red-400">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
