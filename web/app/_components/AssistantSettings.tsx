"use client";

import { useEffect, useState } from "react";

type Preferences = {
  locale: "en-US" | "ko-KR";
  timezone: string;
  memory_enabled: boolean;
  retention_days: number;
  sns_tone_enabled: boolean;
  relationship_tone: "friend" | "flirty" | "romantic";
  response_length: "short" | "normal" | "long";
  voice_response_enabled: boolean;
  voice_summary_enabled: boolean;
  voice_style: "expressive" | "fast";
  voice_speed: number;
  voice_volume: number;
  silent_notification_enabled: boolean;
  silent_notification_frequency: number;
  barge_in_mode: "immediate" | "stop_command";
};

const defaults: Preferences = {
  locale: "en-US",
  timezone: "Asia/Seoul",
  memory_enabled: true,
  retention_days: 30,
  sns_tone_enabled: true,
  relationship_tone: "friend",
  response_length: "normal",
  voice_response_enabled: true,
  voice_summary_enabled: false,
  voice_style: "expressive",
  voice_speed: 1,
  voice_volume: 1,
  silent_notification_enabled: true,
  silent_notification_frequency: 3,
  barge_in_mode: "immediate",
};

export default function AssistantSettings() {
  const [value, setValue] = useState<Preferences>(defaults);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/preferences")
      .then((response) => response.json())
      .then((data) => data.preferences && setValue((current: Preferences) => ({ ...current, ...data.preferences })))
      .catch(() => undefined);
  }, []);

  function set<K extends keyof Preferences>(key: K, next: Preferences[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: value.locale,
          timezone: value.timezone,
          memoryEnabled: value.memory_enabled,
          retentionDays: value.retention_days,
          snsToneEnabled: value.sns_tone_enabled,
          relationshipTone: value.relationship_tone,
          responseLength: value.response_length,
          voiceResponseEnabled: value.voice_response_enabled,
          voiceSummaryEnabled: value.voice_summary_enabled,
          voiceStyle: value.voice_style,
          voiceSpeed: value.voice_speed,
          voiceVolume: value.voice_volume,
          silentNotificationEnabled: value.silent_notification_enabled,
          silentNotificationFrequency: value.silent_notification_frequency,
          bargeInMode: value.barge_in_mode,
        }),
      });
      if (!response.ok) throw new Error("설정을 저장하지 못했습니다.");
      setStatus("설정을 저장했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]">
      <h2 className="text-lg font-bold text-[#684b60]">샐린 대화 설정</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">관계 톤<select value={value.relationship_tone} onChange={(event) => set("relationship_tone", event.target.value as Preferences["relationship_tone"])} className="mt-2 w-full rounded-xl border p-3"><option value="friend">친구</option><option value="flirty">썸</option><option value="romantic">연인</option></select></label>
        <label className="text-sm font-semibold">답변 길이<select value={value.response_length} onChange={(event) => set("response_length", event.target.value as Preferences["response_length"])} className="mt-2 w-full rounded-xl border p-3"><option value="short">짧게</option><option value="normal">보통</option><option value="long">길게</option></select></label>
        <label className="text-sm font-semibold">음성 스타일<select value={value.voice_style} onChange={(event) => set("voice_style", event.target.value as Preferences["voice_style"])} className="mt-2 w-full rounded-xl border p-3"><option value="expressive">Expressive</option><option value="fast">Fast</option></select></label>
        <label className="text-sm font-semibold">끼어들기 방식<select value={value.barge_in_mode} onChange={(event) => set("barge_in_mode", event.target.value as Preferences["barge_in_mode"])} className="mt-2 w-full rounded-xl border p-3"><option value="immediate">말하면 즉시 중단</option><option value="stop_command">stop 명령일 때만 중단</option></select></label>
      </div>
      <div className="mt-5 space-y-3 text-sm font-semibold">
        <label className="flex items-center justify-between"><span>장기기억 저장</span><input type="checkbox" checked={value.memory_enabled} onChange={(event) => set("memory_enabled", event.target.checked)} /></label>
        <label className="flex items-center justify-between"><span>SNS 말투</span><input type="checkbox" checked={value.sns_tone_enabled} onChange={(event) => set("sns_tone_enabled", event.target.checked)} /></label>
        <label className="flex items-center justify-between"><span>음성 응답</span><input type="checkbox" checked={value.voice_response_enabled} onChange={(event) => set("voice_response_enabled", event.target.checked)} /></label>
        <label className="flex items-center justify-between"><span>채팅 음성 요약</span><input type="checkbox" checked={value.voice_summary_enabled} onChange={(event) => set("voice_summary_enabled", event.target.checked)} /></label>
        <label className="flex items-center justify-between"><span>무음 알림</span><input type="checkbox" checked={value.silent_notification_enabled} onChange={(event) => set("silent_notification_enabled", event.target.checked)} /></label>
      </div>
      <button type="button" onClick={save} disabled={saving} className="mt-5 w-full rounded-xl bg-[#e98ab5] px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? "저장 중..." : "설정 저장"}</button>
      {status ? <p className="mt-3 text-sm font-semibold text-[#a4577e]">{status}</p> : null}
    </section>
  );
}
