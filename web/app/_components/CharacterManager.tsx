"use client";

import { useState } from "react";
import Image from "next/image";
import { getMessages, type AppLocale } from "@/app/i18n/messages";

type CharacterManagerProps = {
  initialCharacterId: string;
  locale: AppLocale;
};

const characters = [
  {
    id: "seline",
    number: "01",
    available: true,
  },
  {
    id: "coming-soon-2",
    number: "02",
    available: false,
  },
  {
    id: "coming-soon-3",
    number: "03",
    available: false,
  },
] as const;

export default function CharacterManager({ initialCharacterId, locale }: CharacterManagerProps) {
  const [selected, setSelected] = useState(initialCharacterId || "seline");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const t = getMessages(locale).characters;

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
      setNotice(t.saved);
    } catch {
      setNotice(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {characters.map((character, index) => {
        const isSelected = character.id === selected;
        return (
          <article key={character.id} className={`character-card rounded-3xl border p-6 ${isSelected ? "character-card-selected" : ""} ${!character.available ? "character-card-locked" : ""}`}>
            <div className="relative z-10 flex items-start justify-between gap-3">
              <span className="text-sm font-extrabold text-[#d45d91]">{character.number}</span>
              {isSelected ? <span className="character-selected-badge">{t.selected}</span> : null}
            </div>
            <div className="relative z-10 mt-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#ef8fba] to-[#a895f4] text-xl font-extrabold text-white shadow-lg">{character.available ? <Image src="/seline-icon-v2.png" alt="Seline" width={64} height={64} className="h-full w-full object-cover" /> : "+"}</div>
            <h2 className="relative z-10 mt-5 text-2xl font-extrabold">{t.cards[index].title}</h2>
            <p className="relative z-10 mt-3 min-h-12 text-sm leading-6 text-[#92768a]">{t.cards[index].description}</p>
            {character.available ? (
              <button type="button" disabled={saving || isSelected} onClick={() => void selectCharacter(character.id)} className={`relative z-10 mt-7 w-full rounded-full px-5 py-3 text-sm font-extrabold transition ${isSelected ? "character-selected-button" : "character-select-button"}`}>
                {isSelected ? t.current : (saving ? t.saving : t.choose)}
              </button>
            ) : (
              <div className="mt-7 rounded-full border border-dashed border-[#d9bfd0] px-5 py-3 text-center text-sm font-bold text-[#a07c91]">{t.comingSoon}</div>
            )}
          </article>
        );
      })}
      {notice ? <p className="md:col-span-3 text-center text-sm font-semibold text-[#d45d91]" role="status">{notice}</p> : null}
    </div>
  );
}
