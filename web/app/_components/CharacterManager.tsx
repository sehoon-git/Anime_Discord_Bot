"use client";

import { useState } from "react";
import Image from "next/image";

type Locale = "ko" | "en";

type CharacterManagerProps = {
  initialCharacterId: string;
  locale: Locale;
};

const characters = [
  {
    id: "seline",
    number: "01",
    name: "Seline",
    title: { ko: "셀린", en: "Seline" },
    description: { ko: "다정하고 포근한 목소리로 함께 대화하는 AI 캐릭터", en: "A warm AI character who keeps you company." },
    available: true,
  },
  {
    id: "coming-soon-2",
    number: "02",
    name: "Coming soon",
    title: { ko: "새 캐릭터 준비 중", en: "New character coming soon" },
    description: { ko: "다음 AI 캐릭터가 이 자리에 추가됩니다.", en: "The next AI character will be added here." },
    available: false,
  },
  {
    id: "coming-soon-3",
    number: "03",
    name: "Coming soon",
    title: { ko: "새 캐릭터 준비 중", en: "New character coming soon" },
    description: { ko: "추가 캐릭터를 선택할 수 있도록 준비하고 있습니다.", en: "Another selectable character is being prepared." },
    available: false,
  },
] as const;

export default function CharacterManager({ initialCharacterId, locale }: CharacterManagerProps) {
  const [selected, setSelected] = useState(initialCharacterId || "seline");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ko = locale === "ko";

  async function selectCharacter(characterId: string) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/characters/select", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setSelected(characterId);
      setNotice(ko ? "선택한 캐릭터가 저장되었습니다." : "Your selected character has been saved.");
    } catch {
      setNotice(ko ? "캐릭터 선택을 저장하지 못했습니다. 다시 시도해주세요." : "We could not save your selection. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {characters.map((character) => {
        const isSelected = character.id === selected;
        return (
          <article key={character.id} className={`character-card relative overflow-hidden rounded-3xl border p-6 ${character.id === "seline" ? "character-card-seline" : ""} ${isSelected ? "character-card-selected" : ""} ${!character.available ? "character-card-locked" : ""}`}>
            {character.id === "seline" ? <Image src="/seline-banner-v2.png" alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="pointer-events-none character-card-seline-banner object-cover" /> : null}
            <div className="relative z-10 flex items-start justify-between gap-3">
              <span className="text-sm font-extrabold text-[#d45d91]">{character.number}</span>
              {isSelected ? <span className="character-selected-badge">{ko ? "선택됨" : "Selected"}</span> : null}
            </div>
            <div className="relative z-10 mt-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#ef8fba] to-[#a895f4] text-xl font-extrabold text-white shadow-lg">{character.available ? <Image src="/seline-icon-v2.png" alt="Seline" width={64} height={64} className="h-full w-full object-cover" /> : "+"}</div>
            <h2 className="relative z-10 mt-5 text-2xl font-extrabold">{character.title[locale]}</h2>
            <p className="relative z-10 mt-3 min-h-12 text-sm leading-6 text-[#92768a]">{character.description[locale]}</p>
            {character.available ? (
              <button type="button" disabled={saving || isSelected} onClick={() => void selectCharacter(character.id)} className={`relative z-10 mt-7 w-full rounded-full px-5 py-3 text-sm font-extrabold transition ${isSelected ? "character-selected-button" : "character-select-button"}`}>
                {isSelected ? (ko ? "현재 선택한 캐릭터" : "Current character") : (saving ? (ko ? "저장 중..." : "Saving...") : (ko ? "이 캐릭터 선택하기" : "Choose this character"))}
              </button>
            ) : (
              <div className="mt-7 rounded-full border border-dashed border-[#d9bfd0] px-5 py-3 text-center text-sm font-bold text-[#a07c91]">{ko ? "추가 예정" : "Coming soon"}</div>
            )}
          </article>
        );
      })}
      {notice ? <p className="md:col-span-3 text-center text-sm font-semibold text-[#d45d91]" role="status">{notice}</p> : null}
    </div>
  );
}
