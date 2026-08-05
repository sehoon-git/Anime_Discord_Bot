"use client";

import { useTheme } from "../providers";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="화면 테마">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
          theme === "light"
            ? "border-[#e99abb] bg-[#fff0f7] text-[#c95789] shadow-sm"
            : "border-[#efd8e5] bg-white/60 text-[#92768a] hover:bg-white"
        }`}
      >
        라이트 모드
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
          theme === "dark"
            ? "border-[#a995c4] bg-[#42364d] text-[#fff0f7] shadow-sm"
            : "border-[#efd8e5] bg-white/60 text-[#92768a] hover:bg-white"
        }`}
      >
        다크 모드
      </button>
    </div>
  );
}
