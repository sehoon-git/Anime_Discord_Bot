"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type ConsentErrorResponse = {
  error?: string;
};

type ConsentItemProps = {
  checked: boolean;
  detailHref: string;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
  description?: string;
};

function ConsentItem({
  checked,
  detailHref,
  id,
  label,
  onChange,
  description,
}: ConsentItemProps) {
  return (
    <div className="flex items-start gap-3 font-semibold">
      <input
        id={id}
        className={description ? "mt-1" : undefined}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <label htmlFor={id}>{label}</label>
          <Link
            href={detailHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-blue-400 underline-offset-4 hover:text-blue-300 hover:underline"
          >
            [상세보기]
          </Link>
        </div>
        {description ? (
          <p className="mt-1 text-sm font-normal text-zinc-400">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function ConsentPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [overseas, setOverseas] = useState(false);
  const [memory, setMemory] = useState(false);
  const [voice, setVoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canContinue = terms && privacy && overseas && memory;

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
        body: JSON.stringify({ terms, privacy, overseas, memory, voice }),
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
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-zinc-400">로그인 상태를 확인하는 중...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-8">
        <p className="text-sm font-semibold text-indigo-400">Discord Anime AI</p>
        <h1 className="mt-3 text-4xl font-bold">서비스 이용 동의</h1>
        <p className="mt-4 text-zinc-300">
          Discord Anime AI 사용을 위해 필요한 항목에 동의해주세요.
        </p>

        <div className="mt-8 space-y-4">
          <ConsentItem
            id="consent-terms"
            checked={terms}
            onChange={setTerms}
            label="[필수] 이용약관 동의"
            detailHref="/terms"
          />

          <ConsentItem
            id="consent-privacy"
            checked={privacy}
            onChange={setPrivacy}
            label="[필수] 개인정보 수집 및 이용 동의"
            detailHref="/privacy"
          />

          <ConsentItem
            id="consent-overseas"
            checked={overseas}
            onChange={setOverseas}
            label="[필수] 개인정보 국외 이전 동의"
            detailHref="/privacy"
          />

          <ConsentItem
            id="consent-memory"
            checked={memory}
            onChange={setMemory}
            label="[필수] 장기기억 저장 동의"
            detailHref="/privacy"
            description="AI 캐릭터 대화 품질을 위해 필수로 저장합니다. 저장된 기억은 기억 관리에서 언제든 삭제할 수 있습니다."
          />

          <ConsentItem
            id="consent-voice"
            checked={voice}
            onChange={setVoice}
            label="[선택] 음성 데이터 처리 동의"
            detailHref="/voice-policy"
          />
        </div>

        <button
          type="button"
          disabled={!canContinue || isSaving}
          onClick={handleContinue}
          className="mt-8 w-full rounded-2xl bg-blue-500 px-6 py-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {isSaving ? "저장 중..." : "동의하고 시작하기"}
        </button>

        {errorMessage ? (
          <p className="mt-5 text-sm font-semibold text-red-400">{errorMessage}</p>
        ) : null}
      </section>
    </main>
  );
}
