"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Gender = "female" | "male";
type Locale = "en-US" | "ko-KR";

type ProfileFormProps = {
  initialDisplayName: string;
  initialNickname: string;
  initialGender?: Gender | null;
  initialBirthDate?: string | null;
  initialPhoneNumber?: string | null;
  initialPhoneVerified?: boolean;
  initialLocale?: Locale;
};

type RequiredConsentKey = "terms" | "privacy" | "overseas" | "memory";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-[#efd8e5] bg-white/75 px-4 py-3 text-[#5b4054] outline-none transition placeholder:text-[#b79aaa] focus:border-[#e99abb] focus:bg-white focus:ring-4 focus:ring-[#f6bfd8]/30";

function splitBirthDate(value?: string | null) {
  const [year = "", month = "", day = ""] = value?.split("-") ?? [];
  return { year, month, day };
}

function ConsentLink({ href }: { href: string }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-[#d45d91] hover:text-[#b94c7d]">
      [상세보기]
    </Link>
  );
}

export default function ProfileForm({
  initialDisplayName,
  initialNickname,
  initialGender = null,
  initialBirthDate = null,
  initialPhoneNumber = "",
  initialPhoneVerified = false,
  initialLocale = "en-US",
}: ProfileFormProps) {
  const router = useRouter();
  const initialBirth = splitBirthDate(initialBirthDate);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [nickname, setNickname] = useState(initialNickname);
  const [gender, setGender] = useState<Gender | null>(initialGender);
  const [birthYear, setBirthYear] = useState(initialBirth.year);
  const [birthMonth, setBirthMonth] = useState(initialBirth.month);
  const [birthDay, setBirthDay] = useState(initialBirth.day);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [phoneVerified, setPhoneVerified] = useState(initialPhoneVerified);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [smsUrl, setSmsUrl] = useState("");
  const [phoneMessage, setPhoneMessage] = useState("");
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [overseas, setOverseas] = useState(false);
  const [memory, setMemory] = useState(false);
  const [voice, setVoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const birthDate = useMemo(() => {
    if (birthYear.length !== 4 || !birthMonth || !birthDay) return "";
    return `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`;
  }, [birthDay, birthMonth, birthYear]);

  const requiredConsentsChecked = terms && privacy && overseas && memory;
  const allConsentsChecked = requiredConsentsChecked && voice;
  const canSave = displayName.trim().length >= 2 && nickname.trim().length >= 2 && Boolean(gender) && Boolean(birthDate) && phoneVerified && requiredConsentsChecked;

  function setAllConsents(checked: boolean) {
    setTerms(checked); setPrivacy(checked); setOverseas(checked); setMemory(checked); setVoice(checked);
  }

  function updateRequiredConsent(key: RequiredConsentKey, checked: boolean) {
    ({ terms: setTerms, privacy: setPrivacy, overseas: setOverseas, memory: setMemory }[key])(checked);
  }

  async function requestPhoneCode() {
    setIsCheckingPhone(true); setPhoneMessage("");
    try {
      const response = await fetch("/api/phone-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", phoneNumber }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "인증 문자를 준비하지 못했습니다.");
      setSmsUrl(data.smsUrl ?? "");
      setPhoneMessage(`문자 앱에서 ${data.smsNumber}로 인증번호 ${data.code}를 보내주세요.`);
      setLocale("ko-KR");
    } catch (error) { setPhoneMessage(error instanceof Error ? error.message : "인증 문자를 준비하지 못했습니다."); }
    finally { setIsCheckingPhone(false); }
  }

  async function confirmPhone() {
    setIsCheckingPhone(true); setPhoneMessage("");
    try {
      const response = await fetch("/api/phone-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check", phoneNumber }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "인증이 확인되지 않았습니다.");
      setPhoneVerified(true); setLocale("ko-KR"); setPhoneMessage("휴대폰 인증이 완료되었습니다. 기본 언어를 한국어로 설정했습니다.");
    } catch (error) { setPhoneMessage(error instanceof Error ? error.message : "인증이 확인되지 않았습니다."); }
    finally { setIsCheckingPhone(false); }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || isSaving || !gender) return;
    setIsSaving(true); setErrorMessage("");
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, nickname, gender, birthDate, phoneNumber, locale, terms, privacy, overseas, memory, voice }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setErrorMessage(data?.error ?? "프로필을 저장하지 못했습니다."); return; }
      document.cookie = `locale=${locale}; path=/; max-age=31536000; samesite=lax`;
      router.push("/dashboard"); router.refresh();
    } catch { setErrorMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요."); }
    finally { setIsSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block"><span className="text-sm font-bold text-[#684b60]">이름</span><input type="text" value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass} placeholder="내 이름" /></label>
        <label className="block"><span className="text-sm font-bold text-[#684b60]">닉네임</span><input type="text" value={nickname} maxLength={30} onChange={(event) => setNickname(event.target.value)} className={fieldClass} placeholder="AI가 불러줄 이름" /></label>
      </div>

      <p className="rounded-2xl border border-[#f0d7e5] bg-[#fff5fa] px-4 py-3 text-sm leading-6 text-[#92768a]">AI 캐릭터가 대화 중 이 이름으로 불러줍니다. Discord에서 “나를 OO이라 불러줘”라고 말하면 이 값도 바뀔 수 있습니다.</p>

      <section><h2 className="text-sm font-bold text-[#684b60]">성별</h2><div className="mt-3 grid grid-cols-2 gap-3">{([["female", "여자"], ["male", "남자"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setGender(value)} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${gender === value ? "bg-gradient-to-r from-[#ef8fba] to-[#a895f4] text-white shadow-lg shadow-pink-200/60" : "border border-[#efd8e5] bg-white/65 text-[#806579] hover:border-[#e6a9c4] hover:bg-white"}`}>{label}</button>)}</div></section>

      <section><h2 className="text-sm font-bold text-[#684b60]">생년월일</h2><div className="mt-3 grid grid-cols-3 gap-3"><input inputMode="numeric" maxLength={4} value={birthYear} onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, ""))} className={fieldClass} placeholder="연도 YYYY" /><input inputMode="numeric" maxLength={2} value={birthMonth} onChange={(event) => setBirthMonth(event.target.value.replace(/\D/g, ""))} className={fieldClass} placeholder="월 MM" /><input inputMode="numeric" maxLength={2} value={birthDay} onChange={(event) => setBirthDay(event.target.value.replace(/\D/g, ""))} className={fieldClass} placeholder="일 DD" /></div></section>

      <section className="rounded-3xl border border-[#f0d7e5] bg-white/70 p-5 shadow-xl shadow-pink-100/50">
        <h2 className="text-sm font-bold text-[#684b60]">휴대폰 인증</h2>
        <p className="mt-2 text-sm leading-6 text-[#92768a]">OCTOMO 문자 인증으로 가입을 확인합니다. 인증이 끝나면 한국어가 기본 언어로 선택됩니다.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input inputMode="tel" value={phoneNumber} onChange={(event) => { setPhoneNumber(event.target.value); setPhoneVerified(false); }} className={`${fieldClass} mt-0`} placeholder="01012345678" /><button type="button" onClick={requestPhoneCode} disabled={isCheckingPhone} className="shrink-0 rounded-2xl bg-[#f2a6c7] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">인증 문자 준비</button></div>
        {smsUrl ? <a href={smsUrl} className="mt-3 inline-block rounded-xl bg-[#684b60] px-4 py-2 text-sm font-bold text-white">문자 앱 열기</a> : null}
        {smsUrl ? <button type="button" onClick={confirmPhone} disabled={isCheckingPhone} className="ml-2 rounded-xl border border-[#e9b4cf] px-4 py-2 text-sm font-bold text-[#a4577e] disabled:opacity-60">인증 완료 확인</button> : null}
        {phoneMessage ? <p className="mt-3 text-sm font-semibold text-[#a4577e]">{phoneMessage}</p> : null}
      </section>

      <section className="rounded-3xl border border-[#f0d7e5] bg-[#fffafd]/90 p-5 shadow-xl shadow-pink-100/50"><label className="flex items-center gap-3 text-base font-extrabold text-[#684b60]"><input type="checkbox" checked={allConsentsChecked} onChange={(event) => setAllConsents(event.target.checked)} className="h-4 w-4 accent-[#e878ab]" /><span>약관 전체 동의</span></label><div className="mt-5 space-y-4 text-sm">
        {([ ["terms", "[필수] 서비스 이용약관", "/terms"], ["privacy", "[필수] 개인정보 수집 및 이용", "/privacy"], ["overseas", "[필수] 개인정보 국외 이전", "/privacy"], ["memory", "[필수] 장기기억 저장", "/privacy"], ["voice", "[선택] 음성 데이터 처리", "/voice-policy"] ] as const).map(([key, label, href]) => <label key={key} className="flex items-center justify-between gap-3"><span className={`flex items-center gap-3 font-semibold ${key === "voice" ? "text-[#aa8e9f]" : "text-[#76566b]"}`}><input type="checkbox" checked={key === "terms" ? terms : key === "privacy" ? privacy : key === "overseas" ? overseas : key === "memory" ? memory : voice} onChange={(event) => key === "voice" ? setVoice(event.target.checked) : updateRequiredConsent(key, event.target.checked)} className="accent-[#e878ab]" />{label}</span><ConsentLink href={href} /></label>)}
      </div></section>

      <button type="submit" disabled={!canSave || isSaving} className="w-full rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-6 py-4 font-extrabold text-white shadow-lg shadow-pink-200/60 transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-[#d8cdd4] disabled:to-[#d8cdd4] disabled:shadow-none">{isSaving ? "가입 처리 중..." : "가입하기"}</button>
      {errorMessage ? <p className="rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-sm font-semibold text-red-200">{errorMessage}</p> : null}
    </form>
  );
}
