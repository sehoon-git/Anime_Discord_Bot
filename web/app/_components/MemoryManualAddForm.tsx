"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { locale: "en-US" | "ko-KR" | "ja-JP" };

export default function MemoryManualAddForm({ locale }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ko = locale === "ko-KR";
  const ja = locale === "ja-JP";
  const title = ko ? "직접 기억 추가" : ja ? "記憶を直接追加" : "Add a memory";
  const placeholder = ko ? "예: 나는 판타지 애니를 좋아해" : ja ? "例：私はファンタジーアニメが好き" : "For example: I like fantasy anime";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (content.trim().length < 2 || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/v1/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      if (!response.ok) throw new Error();
      setContent("");
      router.refresh();
    } catch {
      setError(ko ? "기억을 추가하지 못했습니다. 한도를 확인해주세요." : ja ? "記憶を追加できませんでした。上限を確認してください。" : "We could not add the memory. Check your memory limit.");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="manual-memory">{title}</label><input id="manual-memory" value={content} maxLength={500} onChange={(event) => setContent(event.target.value)} placeholder={placeholder} className="min-h-11 flex-1 rounded-xl border border-[#e3bfd3] bg-white/70 px-4 text-sm font-semibold text-[#684b60] outline-none transition placeholder:text-[#b79bab] focus:border-[#d45d91] focus:ring-2 focus:ring-[#d45d91]/15" /><button type="submit" disabled={saving || content.trim().length < 2} className="min-h-11 rounded-xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 text-sm font-extrabold text-white shadow-lg shadow-pink-200/30 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">{saving ? (ko ? "추가 중..." : ja ? "追加中..." : "Adding...") : title}</button>{error ? <p className="basis-full text-sm font-semibold text-red-600">{error}</p> : null}</form>;
}
