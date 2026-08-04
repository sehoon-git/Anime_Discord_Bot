"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <span className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-400">
        확인 중
      </span>
    );
  }

  if (session?.user) {
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold hover:bg-zinc-700"
      >
        로그아웃
      </button>
    );
  }

  return (
      <button
        type="button"
      onClick={() => signIn("google", { callbackUrl: "/consent" })}
      className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold hover:bg-zinc-700"
    >
      Google로 로그인
    </button>
  );
}
