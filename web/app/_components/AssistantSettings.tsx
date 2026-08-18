"use client";

import { useEffect, useState } from "react";
import { getMessages } from "@/app/i18n/messages";

type Locale = "en-US" | "ko-KR" | "ja-JP";
type Preferences = { locale: Locale; timezone: string; memory_enabled: boolean; retention_days: number; sns_tone_enabled: boolean; relationship_tone: "friend" | "flirty" | "romantic"; response_length: "short" | "normal" | "long"; voice_response_enabled: boolean; voice_summary_enabled: boolean; voice_style: "expressive" | "fast"; voice_speed: number; voice_volume: number; silent_notification_enabled: boolean; silent_notification_frequency: number; barge_in_mode: "immediate" | "stop_command" };
const defaults: Preferences = { locale: "en-US", timezone: "Asia/Seoul", memory_enabled: true, retention_days: 30, sns_tone_enabled: true, relationship_tone: "friend", response_length: "normal", voice_response_enabled: true, voice_summary_enabled: false, voice_style: "expressive", voice_speed: 1, voice_volume: 1, silent_notification_enabled: true, silent_notification_frequency: 3, barge_in_mode: "immediate" };

export default function AssistantSettings({ locale = "en-US", title }: { locale?: Locale; title?: string }) {
  const t = getMessages(locale).assistantSettings;
  const [value, setValue] = useState<Preferences>(defaults);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedSetting, setExpandedSetting] = useState<keyof Preferences | null>(null);
  useEffect(() => { fetch("/api/settings/preferences").then((r) => r.json()).then((d) => d.preferences && setValue((v) => ({ ...v, ...d.preferences }))).catch(() => undefined); }, []);
  function set<K extends keyof Preferences>(key: K, next: Preferences[K]) { setValue((current) => ({ ...current, [key]: next })); }
  async function save() {
    setSaving(true); setStatus("");
    try {
      const response = await fetch("/api/settings/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: value.locale, timezone: value.timezone, memoryEnabled: value.memory_enabled, retentionDays: value.retention_days, snsToneEnabled: value.sns_tone_enabled, relationshipTone: value.relationship_tone, responseLength: value.response_length, voiceResponseEnabled: value.voice_response_enabled, voiceSummaryEnabled: value.voice_summary_enabled, voiceStyle: value.voice_style, voiceSpeed: value.voice_speed, voiceVolume: value.voice_volume, silentNotificationEnabled: value.silent_notification_enabled, silentNotificationFrequency: value.silent_notification_frequency, bargeInMode: value.barge_in_mode }) });
      if (!response.ok) throw new Error(t.saveFailed);
      setStatus(t.saved);
    } catch (error) { setStatus(error instanceof Error ? error.message : t.saveFailed); }
    finally { setSaving(false); }
  }
  const toggles = [["memory_enabled", t.memory], ["sns_tone_enabled", t.sns], ["voice_response_enabled", t.voice], ["voice_summary_enabled", t.summary], ["silent_notification_enabled", t.silent]] as const;
  const settingDescriptions: Record<string, string> = t.descriptions;
  return <section className="mt-6 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]"><h2 className="text-lg font-bold text-[#684b60]">{title ?? t.title}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-semibold">{t.relationship}<select value={value.relationship_tone} onChange={(e) => set("relationship_tone", e.target.value as Preferences["relationship_tone"])} className="mt-2 w-full rounded-xl border p-3"><option value="friend">{t.friend}</option><option value="flirty">{t.flirty}</option><option value="romantic">{t.romantic}</option></select></label>
    <label className="text-sm font-semibold">{t.length}<select value={value.response_length} onChange={(e) => set("response_length", e.target.value as Preferences["response_length"])} className="mt-2 w-full rounded-xl border p-3"><option value="short">{t.short}</option><option value="normal">{t.normal}</option><option value="long">{t.long}</option></select></label>
    <label className="text-sm font-semibold">{t.style}<select value={value.voice_style} onChange={(e) => set("voice_style", e.target.value as Preferences["voice_style"])} className="mt-2 w-full rounded-xl border p-3"><option value="expressive">{t.expressive}</option><option value="fast">{t.fast}</option></select></label>
    <label className="text-sm font-semibold">{t.barge}<select value={value.barge_in_mode} onChange={(e) => set("barge_in_mode", e.target.value as Preferences["barge_in_mode"])} className="mt-2 w-full rounded-xl border p-3"><option value="immediate">{t.immediate}</option><option value="stop_command">{t.stop}</option></select></label>
  </div><div className="mt-5 space-y-2 text-sm font-semibold">{toggles.map(([key, text]) => <div key={key} className="grid grid-cols-[7rem_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-1 py-1"><span className="truncate">{text}</span><button type="button" onClick={() => setExpandedSetting(key)} aria-pressed={expandedSetting === key} className={`rounded-full border px-2 py-0.5 text-xs font-semibold transition ${expandedSetting === key ? "border-[#d45d91] bg-[#fff0f7] text-[#d45d91]" : "border-[#e3bfd3] text-[#a4577e] hover:bg-white hover:text-[#d45d91]"}`}>{t.details}</button><p className={`min-w-0 truncate text-xs font-medium text-[#806579] transition-opacity ${expandedSetting === key ? "opacity-100" : "opacity-0"}`} aria-live="polite">{settingDescriptions[key]}</p><input className="justify-self-end" type="checkbox" checked={value[key]} onChange={(e) => set(key, e.target.checked)} /></div>)}</div><button type="button" onClick={save} disabled={saving} aria-busy={saving} className="mt-5 w-full cursor-pointer rounded-full border border-[#ef9fc2] bg-[#8f5f86] px-4 py-3 font-bold text-white shadow-[0_8px_20px_rgba(12,8,18,0.28)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#d879aa] hover:shadow-lg hover:shadow-pink-300/30 active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:transform-none disabled:opacity-60 disabled:shadow-none">{saving ? t.saving : t.save}</button>{status ? <p className="mt-3 text-sm font-semibold text-[#a4577e]">{status}</p> : null}</section>;
}
