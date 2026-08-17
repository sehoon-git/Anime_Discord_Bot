"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function AccountDeletionButton({ locale }: { locale: "ko-KR" | "en-US" | "ja-JP" }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const ko = locale === "ko-KR";
  const ja = locale === "ja-JP";

  async function deleteAccount() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? (ko ? "회원 탈퇴에 실패했습니다." : ja ? "アカウントの削除に失敗しました。" : "Account deletion failed."));
      await signOut({ callbackUrl: "/" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (ko ? "회원 탈퇴에 실패했습니다." : ja ? "アカウントの削除に失敗しました。" : "Account deletion failed."));
      setDeleting(false);
    }
  }

  return <section className="account-delete-card mt-6 rounded-3xl border border-red-200 bg-red-50/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]">
    <h2 className="text-lg font-bold text-red-800">{ko ? "회원 탈퇴" : ja ? "アカウントを削除" : "Delete account"}</h2>
    <p className="mt-2 text-sm leading-6 text-red-700/80">{ko ? "계정, Discord 연결, 설정 및 저장된 대화·기억 정보가 삭제되며 복구할 수 없습니다." : ja ? "アカウント、Discord連携、設定、保存済みの会話・記憶データは削除され、元に戻せません。" : "Your account, Discord connection, settings, and stored conversation and memory data will be permanently deleted."}</p>
    <button type="button" onClick={() => { setError(""); setOpen(true); }} className="account-delete-trigger mt-4 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">{ko ? "회원 탈퇴" : ja ? "アカウントを削除" : "Delete account"}</button>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5" role="dialog" aria-modal="true" aria-labelledby="account-deletion-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-[#493647] shadow-2xl">
        <h3 id="account-deletion-title" className="text-xl font-bold">{ko ? "정말 회원 탈퇴할까요?" : ja ? "本当にアカウントを削除しますか？" : "Delete your account?"}</h3>
        <p className="mt-3 text-sm leading-6 text-[#806579]">{ko ? "이 작업은 취소하거나 복구할 수 없습니다." : ja ? "この操作は取り消し・復元できません。" : "This action cannot be undone."}</p>
        <div className="mt-4 rounded-2xl border border-[#efd4e2] bg-[#fff8fc] p-4 text-sm leading-6 text-[#76566b]">
          <p className="font-bold text-[#684b60]">{ko ? "탈퇴 및 법정 보관 안내" : ja ? "削除と法定保管に関するご案内" : "Deletion and legal retention notice"}</p>
          <p className="mt-2">{ko ? "회원 탈퇴 시 프로필, Discord 연동 정보, 설정, 대화·기억 데이터는 즉시 삭제됩니다." : ja ? "アカウント削除時、プロフィール、Discord連携情報、設定、会話・記憶データはすぐに削除されます。" : "Your profile, Discord connection, settings, conversation data, and memories are deleted immediately."}</p>
          <p className="mt-2">{ko ? "단, 관계 법령에 따라 결제·계약 관련 기록은 법정 보관기간 동안 별도 보관 후 안전하게 삭제됩니다. 보관된 정보는 법적 의무 이행 외 목적으로 이용하지 않습니다." : ja ? "ただし、関係法令により決済・契約に関する記録は法定保管期間中、別途保管された後に安全に削除されます。保管情報は法的義務の履行以外に利用しません。" : "Payment and contract records may be retained separately for legally required periods and are used only to meet legal obligations."}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
            <li>{ko ? "표시·광고 기록: 6개월" : ja ? "表示・広告記録：6か月" : "Advertising records: 6 months"}</li>
            <li>{ko ? "계약·청약철회 기록: 5년" : ja ? "契約・申込撤回記録：5年" : "Contract and withdrawal records: 5 years"}</li>
            <li>{ko ? "결제·서비스 제공 기록: 5년" : ja ? "決済・サービス提供記録：5年" : "Payment and service records: 5 years"}</li>
            <li>{ko ? "소비자 불만·분쟁 처리 기록: 3년" : ja ? "消費者の苦情・紛争処理記録：3年" : "Consumer complaints and dispute records: 3 years"}</li>
          </ul>
        </div>
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={deleting} onClick={() => setOpen(false)} className="rounded-full border border-[#d9b7c9] px-5 py-2.5 text-sm font-semibold text-[#684b60] hover:bg-[#fdf6fa] disabled:opacity-50">{ko ? "취소" : ja ? "キャンセル" : "Cancel"}</button>
          <button type="button" disabled={deleting} onClick={deleteAccount} className="account-delete-trigger rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{deleting ? (ko ? "탈퇴 처리 중..." : ja ? "削除処理中..." : "Deleting...") : (ko ? "회원 탈퇴하기" : ja ? "アカウントを削除" : "Delete account")}</button>
        </div>
      </div>
    </div> : null}
  </section>;
}
