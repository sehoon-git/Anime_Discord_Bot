"use client";

import { useState } from "react";
import { getMessages, type AppLocale } from "@/app/i18n/messages";

export default function CharacterNicknameSettings({ initialNickname, locale }: { initialNickname: string; locale: AppLocale }) {
  const t = getMessages(locale).characters.nickname;
  const [nickname, setNickname] = useState(initialNickname);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function saveNickname() {
    const nextNickname = nickname.trim().replace(/\s+/g, " ");
    if (nextNickname.length < 2) {
      setStatus(t.saveFailed);
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nextNickname }),
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setNickname(nextNickname);
      setStatus(t.saved);
    } catch {
      setStatus(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#684b60]">{t.title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#806579]">{t.description}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-80 sm:flex-row">
          <label className="sr-only" htmlFor="character-nickname">{t.label}</label>
          <input id="character-nickname" value={nickname} maxLength={30} onChange={(event) => setNickname(event.target.value)} placeholder={t.placeholder} className="min-h-11 flex-1 rounded-xl border border-[#e3bfd3] bg-white/70 px-4 text-sm font-semibold text-[#684b60] outline-none transition placeholder:text-[#b79bab] focus:border-[#d45d91] focus:ring-2 focus:ring-[#d45d91]/15" />
          <button type="button" onClick={() => void saveNickname()} disabled={saving} className="min-h-11 rounded-xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 text-sm font-extrabold text-white shadow-lg shadow-pink-200/30 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">{saving ? t.saving : t.save}</button>
        </div>
      </div>
      {status ? <p className="mt-3 text-sm font-semibold text-[#a4577e]" role="status">{status}</p> : null}
    </section>
  );
}
