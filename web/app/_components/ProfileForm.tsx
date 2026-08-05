"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Gender = "female" | "male";

type ProfileFormProps = {
  initialDisplayName: string;
  initialNickname: string;
  initialGender?: Gender | null;
  initialBirthDate?: string | null;
};

type ProfileErrorResponse = {
  error?: string;
};

type RequiredConsentKey = "terms" | "privacy" | "overseas" | "memory";

function splitBirthDate(value?: string | null) {
  const [year = "", month = "", day = ""] = value?.split("-") ?? [];
  return { year, month, day };
}

function ConsentLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-semibold text-blue-400 hover:text-blue-300"
    >
      [상세보기]
    </Link>
  );
}

export default function ProfileForm({
  initialDisplayName,
  initialNickname,
  initialGender = null,
  initialBirthDate = null,
}: ProfileFormProps) {
  const router = useRouter();
  const initialBirth = splitBirthDate(initialBirthDate);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [nickname, setNickname] = useState(initialNickname);
  const [gender, setGender] = useState<Gender | null>(initialGender);
  const [birthYear, setBirthYear] = useState(initialBirth.year);
  const [birthMonth, setBirthMonth] = useState(initialBirth.month);
  const [birthDay, setBirthDay] = useState(initialBirth.day);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [overseas, setOverseas] = useState(false);
  const [memory, setMemory] = useState(false);
  const [voice, setVoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const birthDate = useMemo(() => {
    if (birthYear.length !== 4 || birthMonth.length === 0 || birthDay.length === 0) {
      return "";
    }

    return `${birthYear.padStart(4, "0")}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`;
  }, [birthDay, birthMonth, birthYear]);

  const requiredConsentsChecked = terms && privacy && overseas && memory;
  const allConsentsChecked = requiredConsentsChecked && voice;
  const canSave =
    displayName.trim().length >= 2 &&
    nickname.trim().length >= 2 &&
    Boolean(gender) &&
    Boolean(birthDate) &&
    requiredConsentsChecked;

  function setAllConsents(checked: boolean) {
    setTerms(checked);
    setPrivacy(checked);
    setOverseas(checked);
    setMemory(checked);
    setVoice(checked);
  }

  function updateRequiredConsent(key: RequiredConsentKey, checked: boolean) {
    const setters = {
      terms: setTerms,
      privacy: setPrivacy,
      overseas: setOverseas,
      memory: setMemory,
    };

    setters[key](checked);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || isSaving || !gender) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          nickname,
          gender,
          birthDate,
          terms,
          privacy,
          overseas,
          memory,
          voice,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as ProfileErrorResponse | null;
        setErrorMessage(data?.error ?? "가입 정보를 저장하지 못했습니다.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-zinc-300">이름</span>
          <input
            type="text"
            value={displayName}
            maxLength={40}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full border-0 border-b border-zinc-700 bg-transparent px-0 py-3 text-lg text-white outline-none transition focus:border-indigo-400"
            placeholder="예: 사용자"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-zinc-300">닉네임</span>
          <input
            type="text"
            value={nickname}
            maxLength={30}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-2 w-full border-0 border-b border-zinc-700 bg-transparent px-0 py-3 text-lg text-white outline-none transition focus:border-indigo-400"
            placeholder="AI가 불러줄 이름"
          />
        </label>
      </div>

      <p className="text-sm text-zinc-500">
        AI 캐릭터가 대화 중 닉네임으로 불러줍니다. Discord에서 “나를 OO이라 불러줘”라고 말하면 이 값도 바뀔 수 있습니다.
      </p>

      <section>
        <h2 className="text-sm font-semibold text-zinc-300">성별</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            ["female", "여자"],
            ["male", "남자"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGender(value as Gender)}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                gender === value
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-300">생년월일</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <input
            inputMode="numeric"
            maxLength={4}
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, ""))}
            className="border-0 border-b border-zinc-700 bg-transparent px-0 py-3 text-white outline-none transition focus:border-indigo-400"
            placeholder="연도 YYYY"
          />
          <input
            inputMode="numeric"
            maxLength={2}
            value={birthMonth}
            onChange={(event) => setBirthMonth(event.target.value.replace(/\D/g, ""))}
            className="border-0 border-b border-zinc-700 bg-transparent px-0 py-3 text-white outline-none transition focus:border-indigo-400"
            placeholder="월 MM"
          />
          <input
            inputMode="numeric"
            maxLength={2}
            value={birthDay}
            onChange={(event) => setBirthDay(event.target.value.replace(/\D/g, ""))}
            className="border-0 border-b border-zinc-700 bg-transparent px-0 py-3 text-white outline-none transition focus:border-indigo-400"
            placeholder="일 DD"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-black/30 p-5">
        <label className="flex items-center gap-3 font-bold text-white">
          <input
            type="checkbox"
            checked={allConsentsChecked}
            onChange={(event) => setAllConsents(event.target.checked)}
          />
          <span>약관 전체 동의</span>
        </label>

        <div className="mt-5 space-y-4 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3 font-semibold text-zinc-200">
              <input
                type="checkbox"
                checked={terms}
                onChange={(event) => updateRequiredConsent("terms", event.target.checked)}
              />
              [필수] 서비스 이용약관
            </span>
            <ConsentLink href="/terms" />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3 font-semibold text-zinc-200">
              <input
                type="checkbox"
                checked={privacy}
                onChange={(event) => updateRequiredConsent("privacy", event.target.checked)}
              />
              [필수] 개인정보 수집 및 이용
            </span>
            <ConsentLink href="/privacy" />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3 font-semibold text-zinc-200">
              <input
                type="checkbox"
                checked={overseas}
                onChange={(event) => updateRequiredConsent("overseas", event.target.checked)}
              />
              [필수] 개인정보 국외 이전
            </span>
            <ConsentLink href="/privacy" />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3 font-semibold text-zinc-200">
              <input
                type="checkbox"
                checked={memory}
                onChange={(event) => updateRequiredConsent("memory", event.target.checked)}
              />
              [필수] 장기기억 저장
            </span>
            <ConsentLink href="/privacy" />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3 font-semibold text-zinc-400">
              <input
                type="checkbox"
                checked={voice}
                onChange={(event) => setVoice(event.target.checked)}
              />
              [선택] 음성 데이터 처리
            </span>
            <ConsentLink href="/voice-policy" />
          </label>
        </div>
      </section>

      <button
        type="submit"
        disabled={!canSave || isSaving}
        className="w-full rounded-2xl bg-blue-500 px-6 py-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {isSaving ? "가입 중..." : "가입하기"}
      </button>

      {errorMessage ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-sm font-semibold text-red-200">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
