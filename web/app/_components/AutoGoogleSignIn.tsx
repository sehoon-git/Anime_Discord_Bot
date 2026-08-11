"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef } from "react";

export default function AutoGoogleSignIn({ callbackUrl, locale = "ko-KR" }: { callbackUrl: string; locale?: "en-US" | "ko-KR" }) {
  const started = useRef(false);
  const ko = locale === "ko-KR";

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void signIn("google", { callbackUrl });
  }, [callbackUrl]);

  return <main className="site-wash flex min-h-screen items-center justify-center px-6 py-16 text-[#493647]"><section className="w-full max-w-md rounded-3xl border border-[#f0d7e5] bg-white/80 p-8 text-center shadow-[0_20px_60px_rgba(198,135,169,0.16)]"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl font-extrabold text-[#4285f4] shadow-md">G</span><p className="mt-5 text-sm font-semibold text-[#a4577e]">{ko ? "로그아웃되어 있어 로그인이 필요합니다." : "You are signed out, so login is required."}</p><h1 className="mt-2 text-2xl font-bold text-[#5b4054]">{ko ? "Google 로그인으로 이동 중..." : "Opening Google sign-in..."}</h1><p className="mt-3 text-sm text-[#92768a]">{ko ? "잠시만 기다려 주세요." : "Please wait a moment."}</p></section></main>;
}
