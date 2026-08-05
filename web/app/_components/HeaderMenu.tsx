"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

const menuItems = [
  { href: "/memory", label: "기억 관리" },
  { href: "/settings/privacy", label: "설정" },
];

export default function HeaderMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleAuthClick() {
    setIsOpen(false);

    if (session?.user) {
      signOut({ callbackUrl: "/" });
      return;
    }

    signIn("google", { callbackUrl: "/profile" });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="계정 메뉴 열기"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#806579] hover:bg-[#fff0f7] hover:text-[#d45d91]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {isOpen ? (
        <div className="theme-menu absolute right-0 top-12 w-44 overflow-hidden rounded-2xl border border-[#efd4e2] bg-white py-2 shadow-xl shadow-pink-200/30">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="theme-menu-item block px-4 py-3 text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7] hover:text-[#d45d91]"
            >
              {item.label}
            </Link>
          ))}

          <div className="theme-menu-divider my-2 border-t border-zinc-700" />

          <button
            type="button"
            disabled={status === "loading"}
            onClick={handleAuthClick}
              className="theme-menu-item block w-full px-4 py-3 text-left text-sm font-semibold text-[#76566b] hover:bg-[#fff0f7] hover:text-[#d45d91] disabled:cursor-wait disabled:text-[#b79aaa]"
          >
            {status === "loading" ? "확인 중" : session?.user ? "로그아웃" : "로그인"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
