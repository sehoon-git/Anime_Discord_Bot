"use client";

import { useState } from "react";

type Locale = "en-US" | "ko-KR" | "ja-JP";

export default function LanguageSettings({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const isKorean = locale === "ko-KR";
  const isJapanese = locale === "ja-JP";

  async function changeLocale(nextLocale: Locale) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: nextLocale }) });
      if (!response.ok) throw new Error(isKorean ? "언어 설정을 저장하지 못했습니다." : isJapanese ? "言語設定を保存できませんでした。" : "We could not save your language setting.");
      setLocale(nextLocale);
      document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      setMessage(nextLocale === "ko-KR" ? "언어 설정을 저장했습니다." : nextLocale === "ja-JP" ? "言語設定を保存しました。" : "Language setting saved.");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : (isKorean ? "언어 설정을 저장하지 못했습니다." : isJapanese ? "言語設定を保存できませんでした。" : "We could not save your language setting.")); }
    finally { setSaving(false); }
  }

  const buttonClass = (active: boolean) => `cursor-pointer rounded-2xl border px-4 py-3 text-sm font-bold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:transform-none disabled:shadow-none ${active ? "border-[#e88db8] bg-[#fff0f7] text-[#a4577e]" : "border-[#f0d7e5] bg-white/70 text-[#92768a] hover:bg-white"}`;
  return <div><div className="grid gap-3 sm:grid-cols-3"><button type="button" onClick={() => changeLocale("en-US")} disabled={saving} aria-pressed={locale === "en-US"} className={buttonClass(locale === "en-US")}>English</button><button type="button" onClick={() => changeLocale("ko-KR")} disabled={saving} aria-pressed={locale === "ko-KR"} className={buttonClass(locale === "ko-KR")}>한국어</button><button type="button" onClick={() => changeLocale("ja-JP")} disabled={saving} aria-pressed={locale === "ja-JP"} className={buttonClass(locale === "ja-JP")}>日本語</button></div>{message ? <p className="mt-3 text-sm font-semibold text-[#a4577e]">{message}</p> : null}</div>;
}
