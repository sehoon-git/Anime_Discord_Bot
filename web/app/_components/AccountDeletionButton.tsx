"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function AccountDeletionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const deleteAccount = async () => {
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "회원 탈퇴를 완료하지 못했습니다.");
      }

      await signOut({ callbackUrl: "/" });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "회원 탈퇴를 완료하지 못했습니다.",
      );
      setIsDeleting(false);
    }
  };

  return (
    <section className="mt-8 border-t border-white/10 pt-8">
      <h2 className="text-lg font-bold text-white">회원 탈퇴</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        계정 정보와 Discord 연결 정보, 동의 기록이 삭제됩니다. 탈퇴 후에는 복구할 수 없습니다.
      </p>
      <button
        type="button"
        onClick={() => {
          setError("");
          setIsOpen(true);
        }}
        className="mt-4 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-300"
      >
        회원 탈퇴
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#29212f] p-6 shadow-2xl">
            <h3 id="delete-account-title" className="text-xl font-bold text-white">정말 회원 탈퇴할까요?</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              웹 계정, Discord 연결, 약관 동의 기록이 삭제되며 복구할 수 없습니다.
            </p>
            {error ? <p className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isDeleting} onClick={() => setIsOpen(false)} className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50">
                취소
              </button>
              <button type="button" disabled={isDeleting} onClick={deleteAccount} className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">
                {isDeleting ? "탈퇴 처리 중..." : "회원 탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
