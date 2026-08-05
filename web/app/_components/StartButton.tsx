"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";

export default function StartButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <span className="rounded-2xl bg-[#e9b5cb] px-6 py-3 font-semibold text-white">
        확인 중
      </span>
    );
  }

  if (session?.user) {
    return (
      <Link
        href="/profile"
        className="rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-6 py-3 font-semibold text-white shadow-lg shadow-pink-200/60 hover:brightness-105"
      >
        서비스 시작하기
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/profile" })}
      className="rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-6 py-3 font-semibold text-white shadow-lg shadow-pink-200/60 hover:brightness-105"
    >
      Google로 시작하기
    </button>
  );
}
