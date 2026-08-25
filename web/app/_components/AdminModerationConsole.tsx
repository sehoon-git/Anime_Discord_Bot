"use client";

import { FormEvent, useEffect, useState } from "react";

type BanType = "email" | "discord_user_id" | "ip";
type Ban = { id: string; subject_type: BanType; subject_value: string; reason: string; expires_at: string | null; created_by_email: string; created_at: string; revoked_at: string | null };
type User = { id: string; email: string; name: string | null; nickname: string | null; discord_user_id: string | null; recent_ip: string | null; recent_ip_seen_at: string | null };

const labels: Record<BanType, string> = { email: "계정 이메일", discord_user_id: "Discord 사용자 ID", ip: "IP 주소" };

export default function AdminModerationConsole({ adminEmail }: { adminEmail: string }) {
  const [bans, setBans] = useState<Ban[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [subjectType, setSubjectType] = useState<BanType>("email");
  const [subjectValue, setSubjectValue] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(search = "") {
    const response = await fetch(`/api/admin/moderation${search ? `?q=${encodeURIComponent(search)}` : ""}`, { cache: "no-store" });
    if (!response.ok) { setStatus("관리자 권한을 확인할 수 없습니다."); return; }
    const data = await response.json(); setBans(data.bans ?? []); setUsers(data.users ?? []);
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function search(event: FormEvent) { event.preventDefault(); await load(query.trim()); }
  async function createBan(event: FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectType, subjectValue, reason, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "제재 저장에 실패했습니다.");
      setSubjectValue(""); setReason(""); setExpiresAt(""); setStatus("제재를 적용했습니다."); await load(query.trim());
    } catch (error) { setStatus(error instanceof Error ? error.message : "제재 저장에 실패했습니다."); } finally { setBusy(false); }
  }
  async function revoke(banId: string) {
    if (!window.confirm("이 제재를 해제할까요?")) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/moderation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banId, revokeReason: "관리자 화면에서 해제" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "해제에 실패했습니다.");
      setStatus("제재를 해제했습니다."); await load(query.trim());
    } catch (error) { setStatus(error instanceof Error ? error.message : "해제에 실패했습니다."); } finally { setBusy(false); }
  }
  function chooseUser(user: User, type: "email" | "ip" = "email") { setSubjectType(type); setSubjectValue(type === "ip" ? user.recent_ip ?? "" : user.email); }

  return <div className="mt-8 space-y-6"><section className="rounded-3xl border border-[#efd4e2] bg-white/85 p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">사용자 찾기</h2><p className="mt-1 text-sm text-[#806579]">계정 또는 최근 접속 IP를 선택해 제재 대상으로 바로 입력할 수 있습니다.</p></div></div><form onSubmit={search} className="mt-4 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이메일, 이름, 닉네임 또는 Discord ID" className="min-w-0 flex-1 rounded-xl border border-[#dfbfd2] bg-white p-3" /><button className="rounded-xl border border-[#d45d91] px-5 font-bold text-[#a4577e] transition duration-200 hover:-translate-y-0.5 hover:bg-[#d45d91] hover:text-white hover:shadow-[0_8px_18px_rgba(212,93,145,0.28)] active:translate-y-0">검색</button></form>{users.length ? <div className="mt-4 divide-y divide-[#f1dce7]">{users.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg py-3 hover:bg-[#fff8fc]"><button type="button" onClick={() => chooseUser(user)} className="min-w-0 rounded-lg text-left transition duration-200 hover:-translate-y-0.5 hover:text-[#d45d91]"><strong>{user.nickname || user.name || user.email}</strong><span className="ml-2 text-sm text-[#806579]">{user.email}</span><span className="mt-1 block text-xs text-[#806579]">{user.discord_user_id ? `Discord ${user.discord_user_id}` : "Discord 미연동"}</span></button><div className="flex items-center gap-2"><span className="text-xs text-[#806579]">최근 IP: {user.recent_ip ?? "아직 기록 없음"}</span>{user.recent_ip ? <button type="button" onClick={() => chooseUser(user, "ip")} className="rounded-lg border border-[#d45d91] px-3 py-2 text-xs font-bold text-[#a4577e] transition duration-200 hover:-translate-y-0.5 hover:bg-[#d45d91] hover:text-white hover:shadow-[0_8px_18px_rgba(212,93,145,0.28)] active:translate-y-0">IP로 제재</button> : null}</div></div>)}</div> : query ? <p className="mt-4 text-sm text-[#806579]">검색 결과가 없습니다.</p> : null}</section><section className="rounded-3xl border border-[#efd4e2] bg-white/85 p-6 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">제재 적용</h2><p className="mt-1 text-sm text-[#806579]">처리 관리자: {adminEmail}</p></div><span className="rounded-full bg-[#fff0f7] px-3 py-1 text-xs font-bold text-[#a4577e]">처리 이력 저장됨</span></div><form onSubmit={createBan} className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">제재 유형<select value={subjectType} onChange={(event) => setSubjectType(event.target.value as BanType)} className="mt-2 w-full rounded-xl border border-[#dfbfd2] bg-white p-3"><option value="email">계정 이메일</option><option value="discord_user_id">Discord 사용자 ID</option><option value="ip">IP 주소 (보조 수단)</option></select></label><label className="text-sm font-bold">제재 대상<input required value={subjectValue} onChange={(event) => setSubjectValue(event.target.value)} placeholder={subjectType === "email" ? "user@example.com" : subjectType === "discord_user_id" ? "Discord 사용자 ID" : "203.0.113.10"} className="mt-2 w-full rounded-xl border border-[#dfbfd2] bg-white p-3" /></label><label className="text-sm font-bold md:col-span-2">제재 사유<textarea required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="예: 반복적인 서비스 악용" className="mt-2 min-h-24 w-full rounded-xl border border-[#dfbfd2] bg-white p-3" /></label><label className="text-sm font-bold">만료일 <span className="font-medium text-[#806579]">(비우면 영구)</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dfbfd2] bg-white p-3" /></label><div className="flex items-end md:col-span-2"><button disabled={busy} aria-label="제재 적용하기" style={{ background: "linear-gradient(90deg, #dc5f98 0%, #9c78e8 100%)", color: "#fff" }} className="min-h-14 w-full rounded-2xl border border-[#ffb4d5] px-6 py-4 text-base font-extrabold shadow-[0_12px_26px_rgba(206,89,151,0.36)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "제재 처리 중..." : "제재 적용하기"}</button></div></form>{status ? <p className="mt-4 text-sm font-bold text-[#a4577e]" role="status">{status}</p> : null}</section><section className="rounded-3xl border border-[#efd4e2] bg-white/85 p-6"><h2 className="text-lg font-extrabold">제재 기록</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-[#efd4e2] text-[#806579]"><tr><th className="pb-3">대상</th><th className="pb-3">사유</th><th className="pb-3">상태</th><th className="pb-3">처리</th></tr></thead><tbody>{bans.map((ban) => <tr key={ban.id} className="border-b border-[#f4e6ed]"><td className="py-3"><strong>{labels[ban.subject_type]}</strong><br /><span className="text-[#806579]">{ban.subject_value}</span></td><td className="py-3">{ban.reason}</td><td className="py-3">{ban.revoked_at ? "해제됨" : ban.expires_at ? `~ ${new Date(ban.expires_at).toLocaleString("ko-KR")}` : "영구"}</td><td className="py-3">{ban.revoked_at ? null : <button disabled={busy} onClick={() => revoke(ban.id)} className="rounded-lg border border-[#d45d91] px-3 py-2 font-bold text-[#a4577e] disabled:opacity-50">해제</button>}</td></tr>)}</tbody></table>{!bans.length ? <p className="pt-4 text-sm text-[#806579]">아직 제재 기록이 없습니다.</p> : null}</div></section></div>;
}
