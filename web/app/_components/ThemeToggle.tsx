"use client";

import { useTheme } from "../providers";

type Locale = "en-US" | "ko-KR";

export default function ThemeToggle({ locale = "en-US" }: { locale?: Locale }) {
  const { theme, setTheme } = useTheme();
  const isKorean = locale === "ko-KR";
  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label={isKorean ? "화면 테마" : "Screen theme"}>
      <button type="button" onClick={() => setTheme("light")} aria-pressed={theme === "light"} className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${theme === "light" ? "border-[#e88db8] bg-[#fff0f7] text-[#a4577e]" : "border-[#efd8e5] bg-white/60 text-[#92768a] hover:bg-white"}`}>{isKorean ? "라이트 모드" : "Light mode"}</button>
      <button type="button" onClick={() => setTheme("dark")} aria-pressed={theme === "dark"} className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${theme === "dark" ? "border-[#a995c4] bg-[#42364d] text-[#fff0f7]" : "border-[#efd8e5] bg-white/60 text-[#92768a] hover:bg-white"}`}>{isKorean ? "다크 모드" : "Dark mode"}</button>
    </div>
  );
}
