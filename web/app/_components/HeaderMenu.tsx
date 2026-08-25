"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Locale = "en-US" | "ko-KR" | "ja-JP";

export default function HeaderMenu({ locale, showAdmin = false }: { locale: Locale; showAdmin?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  const ko = locale === "ko-KR";
  const ja = locale === "ja-JP";

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  function authenticate() {
    setIsOpen(false);
    if (session?.user) signOut({ callbackUrl: "/" });
    else signIn("google", { callbackUrl: window.location.pathname });
  }

  return (
    <div ref={menuRef} className="relative">
      <button type="button" aria-label={ko ? "계정 메뉴 열기" : ja ? "アカウントメニューを開く" : "Open account menu"} aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} className="header-icon-control group relative flex h-10 w-10 items-center justify-center rounded-full text-[#806579] transition hover:scale-105 hover:bg-[#fff0f7] hover:text-[#d45d91] hover:shadow-[0_6px_16px_rgba(212,93,145,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d45d91]/50">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
        <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#efcfdf] bg-[#fff8fc] px-2 py-1 text-xs font-semibold text-[#76566b] opacity-0 shadow-lg shadow-pink-200/20 transition group-hover:opacity-100 group-focus-visible:opacity-100">{ko ? "계정" : ja ? "アカウント" : "Account"}</span>
      </button>
      {isOpen ? (
        <div className="theme-menu absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-2xl border border-[#efd4e2] bg-white py-2 shadow-xl shadow-pink-200/30">
          <Link href="/memory" onClick={() => setIsOpen(false)} className="theme-menu-item block px-4 py-3 text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7]">{ko ? "기억 관리" : ja ? "記憶管理" : "Memory"}</Link>
          <Link href="/settings/privacy" onClick={() => setIsOpen(false)} className="theme-menu-item block px-4 py-3 text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7]">{ko ? "설정" : ja ? "設定" : "Settings"}</Link>
          <Link href="/notice" onClick={() => setIsOpen(false)} className="theme-menu-item block px-4 py-3 text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7]">{ko ? "공지사항" : ja ? "お知らせ" : "Notices"}</Link>
          {showAdmin ? <Link href="/admin" onClick={() => setIsOpen(false)} className="theme-menu-item block px-4 py-3 text-sm font-bold text-[#a4577e] hover:bg-[#fff0f7]">{ko ? "관리자 페이지" : ja ? "管理者ページ" : "Admin"}</Link> : null}
          <div className="my-2 border-t border-[#efd4e2]" />
          <button type="button" disabled={status === "loading"} onClick={authenticate} className="theme-menu-item flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7] disabled:cursor-wait">
            {session?.user ? null : <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-extrabold text-[#4285f4] shadow-sm">G</span>}{status === "loading" ? (ko ? "확인 중..." : ja ? "確認中..." : "Checking...") : session?.user ? (ko ? "로그아웃" : ja ? "ログアウト" : "Log out") : (ko ? "Google로 로그인" : ja ? "Googleでログイン" : "Continue with Google")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
