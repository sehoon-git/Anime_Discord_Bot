"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProfileFormProps = {
  initialDisplayName: string;
  initialNickname: string;
};

type ProfileErrorResponse = {
  error?: string;
};

export default function ProfileForm({
  initialDisplayName,
  initialNickname,
}: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [nickname, setNickname] = useState(initialNickname);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canSave = displayName.trim().length >= 2 && nickname.trim().length >= 2;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || isSaving) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, nickname }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as ProfileErrorResponse | null;
        setErrorMessage(data?.error ?? "프로필 저장에 실패했습니다.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <label className="block">
        <span className="text-sm font-semibold text-zinc-300">이름</span>
        <input
          type="text"
          value={displayName}
          maxLength={40}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-2 w-full border-0 border-b border-zinc-700 bg-transparent px-0 py-3 text-lg text-white outline-none transition focus:border-indigo-400"
          placeholder="예: 사용자"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-zinc-300">닉네임</span>
        <input
          type="text"
          value={nickname}
          maxLength={30}
          onChange={(event) => setNickname(event.target.value)}
          className="mt-2 w-full border-0 border-b border-zinc-700 bg-transparent px-0 py-3 text-lg text-white outline-none transition focus:border-indigo-400"
          placeholder="AI가 불러줄 이름"
        />
        <span className="mt-2 block text-sm text-zinc-500">
          AI 캐릭터가 대화 중 이 이름으로 불러줍니다. Discord에서 “나를 OO이라 불러줘”라고 말하면 이 값도 바뀔 수 있습니다.
        </span>
      </label>

      <button
        type="submit"
        disabled={!canSave || isSaving}
        className="w-full rounded-2xl bg-blue-500 px-6 py-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {isSaving ? "저장 중..." : "확인"}
      </button>

      {errorMessage ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-sm font-semibold text-red-200">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
