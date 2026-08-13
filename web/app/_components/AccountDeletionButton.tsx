"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function AccountDeletionButton({ locale }: { locale: "ko-KR" | "en-US" }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const ko = locale === "ko-KR";

  async function deleteAccount() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? (ko ? "회원 탈퇴에 실패했습니다." : "Account deletion failed."));
      await signOut({ callbackUrl: "/" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ko ? "회원 탈퇴에 실패했습니다." : "Account deletion failed."));
      setDeleting(false);
    }
  }

  return <section className="mt-6 rounded-3xl border border-red-200 bg-red-50/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]">
    <h2 className="text-lg font-bold text-red-800">{ko ? "회원 탈퇴" : "Delete account"}</h2>
    <p className="mt-2 text-sm leading-6 text-red-700/80">{ko ? "계정, Discord 연결, 설정 및 저장된 대화·기억 정보가 삭제되며 복구할 수 없습니다." : "Your account, Discord connection, settings, and stored conversation and memory data will be permanently deleted."}</p>
    <button type="button" onClick={() => { setError(""); setOpen(true); }} className="mt-4 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">{ko ? "회원 탈퇴" : "Delete account"}</button>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5" role="dialog" aria-modal="true" aria-labelledby="account-deletion-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-[#493647] shadow-2xl">
        <h3 id="account-deletion-title" className="text-xl font-bold">{ko ? "정말 회원 탈퇴할까요?" : "Delete your account?"}</h3>
        <p className="mt-3 text-sm leading-6 text-[#806579]">{ko ? "이 작업은 취소하거나 복구할 수 없습니다." : "This action cannot be undone."}</p>
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={deleting} onClick={() => setOpen(false)} className="rounded-full border border-[#d9b7c9] px-5 py-2.5 text-sm font-semibold text-[#684b60] hover:bg-[#fdf6fa] disabled:opacity-50">{ko ? "취소" : "Cancel"}</button>
          <button type="button" disabled={deleting} onClick={deleteAccount} className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{deleting ? (ko ? "탈퇴 처리 중..." : "Deleting...") : (ko ? "회원 탈퇴하기" : "Delete account")}</button>
        </div>
      </div>
    </div> : null}
  </section>;
}
