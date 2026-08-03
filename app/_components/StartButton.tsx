"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";

export default function StartButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <span className="rounded-xl bg-indigo-500/60 px-6 py-3 font-semibold text-white">
        확인 중
      </span>
    );
  }

  if (session?.user) {
    return (
      <Link
        href="/consent"
        className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white hover:bg-indigo-400"
      >
        서비스 시작하기
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/consent" })}
      className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white hover:bg-indigo-400"
    >
      Google로 시작하기
    </button>
  );
}
