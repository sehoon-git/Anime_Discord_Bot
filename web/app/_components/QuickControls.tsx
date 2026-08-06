"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "../providers";

type Locale = "en-US" | "ko-KR";

export default function QuickControls({ locale }: { locale: Locale }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ko = locale === "ko-KR";

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  async function changeLocale(nextLocale: Locale) {
    document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
    } catch {
      // The locale cookie also supports visitors who are not signed in.
    }
    window.location.reload();
  }

  return (
    <div ref={menuRef} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={theme === "dark" ? (ko ? "라이트 모드로 전환" : "Switch to light mode") : (ko ? "다크 모드로 전환" : "Switch to dark mode")}
        title={theme === "dark" ? (ko ? "라이트 모드" : "Light mode") : (ko ? "다크 모드" : "Dark mode")}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#806579] transition hover:bg-[#fff0f7] hover:text-[#d45d91]"
      >
        {theme === "dark" ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={ko ? "언어 선택" : "Choose language"}
        aria-expanded={open}
        title={ko ? "언어" : "Language"}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#806579] transition hover:bg-[#fff0f7] hover:text-[#d45d91]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z" /></svg>
      </button>
      {open ? (
        <div className="theme-menu absolute right-0 top-14 z-50 w-40 overflow-hidden rounded-2xl border border-[#efd4e2] bg-white p-2 shadow-xl shadow-pink-200/30">
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#aa8e9f]">{ko ? "언어" : "Language"}</p>
          <button type="button" onClick={() => changeLocale("en-US")} className={`theme-menu-item block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${locale === "en-US" ? "bg-[#fff0f7] text-[#d45d91]" : "text-[#76566b] hover:bg-[#fff0f7]"}`}>English</button>
          <button type="button" onClick={() => changeLocale("ko-KR")} className={`theme-menu-item block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${locale === "ko-KR" ? "bg-[#fff0f7] text-[#d45d91]" : "text-[#76566b] hover:bg-[#fff0f7]"}`}>한국어</button>
        </div>
      ) : null}
    </div>
  );
}
