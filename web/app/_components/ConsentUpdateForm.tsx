"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Locale = "en-US" | "ko-KR" | "ja-JP";
type ConsentKey = "terms" | "privacy" | "overseas" | "memory" | "voice" | "security_ip";

export default function ConsentUpdateForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const ko = locale === "ko-KR";
  const ja = locale === "ja-JP";
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({ terms: false, privacy: false, overseas: false, memory: false, voice: false, security_ip: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const allChecked = Object.values(consents).every(Boolean);
  const items: Array<[ConsentKey, string, string]> = ko
    ? [["terms", "[필수] 서비스 이용약관", "/terms"], ["privacy", "[필수] 개인정보 수집 및 이용", "/privacy"], ["overseas", "[필수] 개인정보 국외 이전", "/privacy"], ["memory", "[필수] 장기기억 저장", "/privacy"], ["voice", "[필수] 음성 데이터 처리", "/voice-policy"], ["security_ip", "[필수] 접속 IP 주소 수집·이용 (계정 보안 및 부정 이용 방지)", "/privacy"]]
    : ja ? [["terms", "[必須] サービス利用規約", "/terms"], ["privacy", "[必須] 個人情報の収集・利用", "/privacy"], ["overseas", "[必須] 個人情報の国外移転", "/privacy"], ["memory", "[必須] 長期記憶の保存", "/privacy"], ["voice", "[必須] 音声データ処理", "/voice-policy"], ["security_ip", "[必須] 接続 IP アドレスの収集・利用（アカウント保護・不正利用防止）", "/privacy"]]
    : [["terms", "[Required] Terms of Service", "/terms"], ["privacy", "[Required] Privacy collection and use", "/privacy"], ["overseas", "[Required] Overseas transfer of personal data", "/privacy"], ["memory", "[Required] Long-term memory storage", "/privacy"], ["voice", "[Required] Voice data processing", "/voice-policy"], ["security_ip", "[Required] Connection IP address collection and use (account security and abuse prevention)", "/privacy"]];

  function setAll(checked: boolean) { setConsents({ terms: checked, privacy: checked, overseas: checked, memory: checked, voice: checked, security_ip: checked }); }
  async function submit() {
    if (!allChecked || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(consents) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? (ko ? "동의 정보를 저장하지 못했습니다." : ja ? "同意情報を保存できませんでした。" : "We could not save your consent."));
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : (ko ? "동의 정보를 저장하지 못했습니다." : ja ? "同意情報を保存できませんでした。" : "We could not save your consent.")); }
    finally { setSaving(false); }
  }

  return <section className="mt-8 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.12)]"><label className="flex items-center gap-3 text-base font-extrabold text-[#684b60]"><input type="checkbox" checked={allChecked} onChange={(event) => setAll(event.target.checked)} className="h-4 w-4 accent-[#e878ab]" /><span>{ko ? "약관 전체 동의" : ja ? "すべての規約に同意" : "Agree to all terms"}</span></label><div className="mt-5 space-y-4 text-sm">{items.map(([key, text, href]) => <label key={key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-3 font-semibold text-[#76566b]"><input type="checkbox" checked={consents[key]} onChange={(event) => setConsents((current) => ({ ...current, [key]: event.target.checked }))} className="accent-[#e878ab]" />{text}</span><Link href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-[#d45d91] hover:text-[#b94c7d]">[{ko ? "상세보기" : ja ? "詳細を見る" : "View details"}]</Link></label>)}</div><button type="button" onClick={submit} disabled={!allChecked || saving} className="mt-6 w-full rounded-full border border-[#ef9fc2] bg-[#8f5f86] px-4 py-3 font-bold text-white shadow-[0_8px_20px_rgba(12,8,18,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#d879aa] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">{saving ? (ko ? "저장 중..." : ja ? "保存中..." : "Saving...") : (ko ? "동의하고 계속하기" : ja ? "同意して続ける" : "Agree and continue")}</button>{error ? <p className="mt-3 text-sm font-semibold text-red-500">{error}</p> : null}</section>;
}
