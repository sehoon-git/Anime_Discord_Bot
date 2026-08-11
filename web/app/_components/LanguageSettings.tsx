"use client";

import { useState } from "react";

type Locale = "en-US" | "ko-KR";

export default function LanguageSettings({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const isKorean = locale === "ko-KR";

  async function changeLocale(nextLocale: Locale) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: nextLocale }) });
      if (!response.ok) throw new Error(isKorean ? "언어 설정을 저장하지 못했습니다." : "We could not save your language setting.");
      setLocale(nextLocale);
      document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      setMessage(nextLocale === "ko-KR" ? "언어 설정을 저장했습니다." : "Language setting saved.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : (isKorean ? "언어 설정을 저장하지 못했습니다." : "We could not save your language setting.")); }
    finally { setSaving(false); }
  }

  return <div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => changeLocale("en-US")} disabled={saving} aria-pressed={locale === "en-US"} className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm font-bold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:transform-none disabled:shadow-none ${locale === "en-US" ? "border-[#e88db8] bg-[#fff0f7] text-[#a4577e]" : "border-[#f0d7e5] bg-white/70 text-[#92768a] hover:bg-white"}`}>English</button><button type="button" onClick={() => changeLocale("ko-KR")} disabled={saving} aria-pressed={locale === "ko-KR"} className={`cursor-pointer rounded-2xl border px-4 py-3 text-sm font-bold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:transform-none disabled:shadow-none ${locale === "ko-KR" ? "border-[#e88db8] bg-[#fff0f7] text-[#a4577e]" : "border-[#f0d7e5] bg-white/70 text-[#92768a] hover:bg-white"}`}>한국어</button></div>{message ? <p className="mt-3 text-sm font-semibold text-[#a4577e]">{message}</p> : null}</div>;
}
