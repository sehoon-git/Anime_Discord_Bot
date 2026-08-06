"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import StartButton from "./StartButton";

type Locale = "en" | "ko";

const copy = {
  en: {
    titleLines: ["Meet Seline on Discord", "AI character voice chat"],
    eyebrow: "Discord Anime AI / voice chat",
    description: "Talk with your favorite character, hear her voice, and keep the moments you share.\nA warm AI conversation that begins on Discord.",
    learnMore: "Learn more", sceneLabel: "A conversation with Seline, an AI character", talking: "In conversation",
    firstMessage: "What would you like to talk about today?", secondMessage: "I am a little tired. I want to hear your voice.", thirdMessage: "Then let us take it slowly. I am right here.", voiceReady: "Voice chat is getting ready",
    features: [["Character selection", "Choose your favorite AI character for each server and set their tone and voice."], ["Voice chat", "Talk naturally with your character in a Discord voice channel."], ["Memory management", "Your conversations are remembered, and you can review or remove them whenever you want."]],
  },
  ko: {
    titleLines: ["디스코드에서 만나는", "AI 캐릭터 음성 대화"],
    eyebrow: "Discord Anime AI / voice chat",
    description: "좋아하는 캐릭터와 이야기를 나누고, 목소리를 듣고, 함께한 순간을 기억해요.\n디스코드에서 시작하는 가장 포근한 AI 대화입니다.",
    learnMore: "더 알아보기", sceneLabel: "Seline AI 캐릭터와 대화하는 화면", talking: "지금 대화 중",
    firstMessage: "오늘은 어떤 이야기부터 해볼까요?", secondMessage: "조금 지쳤는데 목소리 듣고 싶어.", thirdMessage: "그럼 천천히 이야기해요. 여기 있을게요.", voiceReady: "음성 대화 준비 중",
    features: [["캐릭터 선택", "서버마다 좋아하는 AI 캐릭터를 골라 말투와 목소리를 설정해요."], ["음성 채팅", "디스코드 음성 채널에서 캐릭터와 자연스럽게 대화해요."], ["기억 관리", "나눈 이야기를 기억하고, 원할 때 직접 확인하고 지울 수 있어요."]],
  },
} as const;

export default function HomeHero({ locale = "ko" }: { locale?: Locale }) {
  const text = copy[locale];
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const currentLine = text.titleLines[lineIndex];
    if (visibleCount < currentLine.length) {
      const timer = window.setTimeout(() => setVisibleCount((count) => count + 1), 75);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => { setVisibleCount(0); setLineIndex((index) => (index + 1) % text.titleLines.length); }, 2600);
    return () => window.clearTimeout(timer);
  }, [lineIndex, text.titleLines, visibleCount]);

  return <>
    <section className="relative isolate mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-16 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true"><div className="hero-sparkle hero-sparkle-one" /><div className="hero-sparkle hero-sparkle-two" /><div className="hero-character-glow" /></div>
      <div className="relative z-10 max-w-3xl">
        <p className="mb-6 text-sm font-bold tracking-wide text-[#d45d91]">{text.eyebrow}</p>
        <h1 className="min-h-[8.5rem] whitespace-pre-line text-5xl font-extrabold leading-[1.18] tracking-[-0.03em] text-[#5b4054] md:text-7xl">{text.titleLines[lineIndex].slice(0, visibleCount)}<span className="type-caret" aria-hidden="true" /></h1>
        <p className="mx-auto mt-7 max-w-xl whitespace-pre-line text-lg leading-8 text-[#806579]">{text.description}</p>
        <div className="mt-14 flex flex-col justify-center gap-3 sm:flex-row"><StartButton locale={locale} /><a href="#features" className="rounded-2xl border border-[#e3bfd3] bg-white/70 px-6 py-3 font-semibold text-[#76566b] shadow-sm transition hover:-translate-y-0.5 hover:bg-white">{text.learnMore}</a></div>
      </div>
      <div className="hero-scene relative z-10 mt-[4.5rem] w-full max-w-4xl" aria-label={text.sceneLabel}>
        <div className="hero-character" aria-hidden="true"><Image src="/seline-icon.png" alt="" fill priority sizes="(max-width: 1024px) 45vw, 360px" className="object-cover" /></div>
        <div className="hero-window relative z-10">
          <div className="flex items-center justify-between border-b border-[#f0d7e5] px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f58bb6] to-[#a895f4] text-xs font-bold text-white">AI</span><div className="text-left"><p className="text-sm font-bold text-[#684b60]">Seline</p><p className="text-xs text-[#ad8fa1]">{text.talking}</p></div></div><span className="live-dot" aria-label="Online" /></div>
          <div className="space-y-4 px-5 py-6 text-left"><p className="chat-bubble chat-bubble-ai">{text.firstMessage}</p><p className="chat-bubble chat-bubble-user">{text.secondMessage}</p><p className="chat-bubble chat-bubble-ai chat-bubble-delay">{text.thirdMessage}</p></div>
          <div className="mx-5 mb-5 flex items-center gap-2 rounded-2xl bg-[#fff0f7] px-4 py-3 text-sm text-[#d45d91]"><span className="sound-wave"><i /><i /><i /><i /></span>{text.voiceReady}</div>
        </div>
        <span className="hero-sticker hero-sticker-heart" aria-hidden="true">♥</span><span className="hero-sticker hero-sticker-star" aria-hidden="true">✦</span>
      </div>
    </section>
    <section id="features" className="mx-auto grid max-w-6xl gap-5 px-6 pb-24 md:grid-cols-3">{text.features.map(([title, description], index) => <article key={title} className="feature-reveal rounded-3xl border border-[#f0d7e5] bg-white/75 p-7 text-left shadow-[0_12px_35px_rgba(205,151,180,0.12)]" style={{ animationDelay: `${index * 120}ms` }}><span className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#fff0f7] text-sm font-bold text-[#d45d91]">0{index + 1}</span><h2 className="text-xl font-bold text-[#684b60]">{title}</h2><p className="mt-3 leading-7 text-[#92768a]">{description}</p></article>)}</section>
  </>;
}
