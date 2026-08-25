"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { memoryId: string; content: string; locale: "en-US" | "ko-KR" | "ja-JP" };

export default function MemoryEditButton({ memoryId, content, locale }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(content);
  const [saving, setSaving] = useState(false);
  const ko = locale === "ko-KR";
  const ja = locale === "ja-JP";
  const edit = ko ? "수정" : ja ? "編集" : "Edit";

  async function save() {
    if (saving || value.trim().length < 2) return;
    setSaving(true);
    try {
      const response = await fetch(`/v1/memories/${memoryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: value }) });
      if (!response.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-[#d6a5bd] px-4 py-2 text-sm font-semibold text-[#a4577e] transition hover:bg-pink-100">{edit}</button>;
  return <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row"><input value={value} maxLength={500} onChange={(event) => setValue(event.target.value)} className="min-h-10 flex-1 rounded-xl border border-[#e3bfd3] bg-white px-3 text-sm font-semibold text-[#684b60]" /><button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-[#d45d91] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? (ko ? "저장 중" : ja ? "保存中" : "Saving") : (ko ? "저장" : ja ? "保存" : "Save")}</button><button type="button" onClick={() => { setValue(content); setEditing(false); }} className="rounded-xl border border-[#d6a5bd] px-4 py-2 text-sm font-bold text-[#76566b]">{ko ? "취소" : ja ? "キャンセル" : "Cancel"}</button></div>;
}
