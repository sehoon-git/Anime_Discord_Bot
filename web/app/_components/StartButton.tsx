"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";

export default function StartButton({ locale = "ko" }: { locale?: "en" | "ko" }) {
  const { data: session, status } = useSession();
  const labels = locale === "en"
    ? { loading: "Checking...", profile: "Start the service", login: "Start with Google" }
    : { loading: "확인 중...", profile: "서비스 시작하기", login: "Google로 시작하기" };

  if (status === "loading") {
    return <span className="rounded-2xl bg-[#e9b5cb] px-6 py-3 font-semibold text-white">{labels.loading}</span>;
  }

  if (session?.user) {
    return <Link href="/dashboard" className="rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-6 py-3 font-semibold text-white shadow-lg shadow-pink-200/60 hover:brightness-105">{labels.profile}</Link>;
  }

  return <button type="button" onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-6 py-3 font-semibold text-white shadow-lg shadow-pink-200/60 hover:brightness-105">{labels.login}</button>;
}
