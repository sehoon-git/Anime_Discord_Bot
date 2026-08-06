"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Locale = "en-US" | "ko-KR";
export default function HeaderMenu({ locale }: { locale: Locale }) {
  const [isOpen, setIsOpen] = useState(false); const menuRef = useRef<HTMLDivElement>(null); const { data: session, status } = useSession(); const ko = locale === "ko-KR";
  useEffect(() => { const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); }; document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); }; }, []);
  function handleAuthClick() { setIsOpen(false); if (session?.user) signOut({ callbackUrl: "/" }); else signIn("google", { callbackUrl: "/profile" }); }
  return <div ref={menuRef} className="relative"><button type="button" aria-label={ko ? "계정 메뉴 열기" : "Open account menu"} aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} className="flex h-10 w-10 items-center justify-center rounded-full text-[#806579] hover:bg-[#fff0f7] hover:text-[#d45d91]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg></button>{isOpen ? <div className="theme-menu absolute right-0 top-12 w-44 overflow-hidden rounded-2xl border border-[#efd4e2] bg-white py-2 shadow-xl shadow-pink-200/30"><Link href="/memory" onClick={() => setIsOpen(false)} className="theme-menu-item block px-4 py-3 text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7]">{ko ? "기억 관리" : "Memory"}</Link><Link href="/settings/privacy" onClick={() => setIsOpen(false)} className="theme-menu-item block px-4 py-3 text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7]">{ko ? "설정" : "Settings"}</Link><div className="theme-menu-divider my-2 border-t border-[#efd4e2]" /><button type="button" disabled={status === "loading"} onClick={handleAuthClick} className="theme-menu-item block w-full px-4 py-3 text-left text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7] disabled:cursor-wait">{status === "loading" ? (ko ? "확인 중..." : "Checking...") : session?.user ? (ko ? "로그아웃" : "Log out") : (ko ? "로그인" : "Log in")}</button></div> : null}</div>;
}
