"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import StartButton from "./StartButton";

type Locale = "en" | "ko" | "ja";

const copy = {
  en: {
    titleLines: ["Meet Seline on Discord", "AI character voice chat"],
    eyebrow: "Voice With AI / voice chat",
    description: "Talk with your favorite character, hear her voice, and keep the moments you share.\nA warm AI conversation that begins on Discord.",
    learnMore: "Learn more", sceneLabel: "A conversation with Seline, an AI character", talking: "In conversation",
    firstMessage: "What would you like to talk about today?", secondMessage: "I am a little tired. I want to hear your voice.", thirdMessage: "Then let us take it slowly. I am right here.", voiceReady: "Voice chat is getting ready",
    journey: {
      eyebrow: "GETTING STARTED",
      title: "Three simple steps to start talking",
      description: "Connect your Discord account, choose a character, then invite the bot to your server.",
      steps: [
        ["Connect your Discord account", "Link your web and Discord accounts to confirm bot access.", "Connect account", "/dashboard"],
        ["Choose your character", "Set a character's tone and voice to match your conversation.", "Choose Seline", "/characters"],
        ["Invite the bot and start talking", "Invite the bot from your dashboard, then begin chatting in your server.", "Open bot invite", "/dashboard"],
      ],
    },
  },
  ko: {
    titleLines: ["디스코드에서 만나는", "AI 캐릭터 음성 대화"],
    eyebrow: "Voice With AI / voice chat",
    description: "좋아하는 캐릭터와 이야기를 나누고, 목소리를 듣고, 함께한 순간을 기억해요.\n디스코드에서 시작하는 가장 포근한 AI 대화입니다.",
    learnMore: "더 알아보기", sceneLabel: "Seline AI 캐릭터와 대화하는 화면", talking: "지금 대화 중",
    firstMessage: "오늘은 어떤 이야기부터 해볼까요?", secondMessage: "조금 지쳤는데 목소리 듣고 싶어.", thirdMessage: "그럼 천천히 이야기해요. 여기 있을게요.", voiceReady: "음성 대화 준비 중",
    journey: {
      eyebrow: "이용 시작하기",
      title: "세 단계면 대화를 시작할 수 있어요",
      description: "Discord 계정을 연결하고, 캐릭터를 고른 뒤 Discord 서버에서 바로 대화를 시작하세요.",
      steps: [
        ["Discord 계정 연결", "웹 계정과 Discord 계정을 연결해 봇 사용 권한을 확인하세요.", "계정 연결하기", "/dashboard"],
        ["캐릭터 선택", "나에게 맞는 캐릭터의 말투와 대화 방식을 설정하세요.", "캐릭터 설정", "/characters"],
        ["봇 초대 후 대화 시작", "대시보드에서 봇을 Discord 서버에 초대하면 음성 채팅을 시작할 수 있어요.", "대시보드에서 봇 초대하기", "/dashboard"],
      ],
    },
  },
  ja: {
    titleLines: ["Discordで出会う", "AIキャラクター音声チャット"],
    eyebrow: "Voice With AI / voice chat",
    description: "好きなキャラクターと会話し、声を聞き、一緒に過ごした瞬間を覚えていきます。\nDiscordから始まる、やさしいAIとの会話です。",
    learnMore: "詳しく見る", sceneLabel: "AIキャラクターSelineとの会話画面", talking: "会話中",
    firstMessage: "今日はどんな話から始めましょうか？", secondMessage: "少し疲れたから、声を聞きたい。", thirdMessage: "では、ゆっくり話しましょう。ここにいますよ。", voiceReady: "音声会話を準備中",
    journey: {
      eyebrow: "はじめ方",
      title: "3ステップで会話を始められます",
      description: "Discordアカウントを連携し、キャラクターを選んで、サーバーへボットを招待しましょう。",
      steps: [
        ["Discordアカウントを連携", "WebとDiscordアカウントを連携して、ボットの利用権限を確認します。", "アカウントを連携", "/dashboard"],
        ["キャラクターを選択", "会話に合うキャラクターの話し方と声を設定します。", "キャラクター設定", "/characters"],
        ["ボットを招待して会話開始", "ダッシュボードからボットをサーバーへ招待して会話を始めます。", "ボットを招待", "/dashboard"],
      ],
    },
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
      <div className="hero-side-decor pointer-events-none absolute inset-x-0 top-[29%] hidden items-center justify-between px-8 lg:flex" aria-hidden="true">
        <div className="hero-side-cluster hero-side-cluster-left">
          <span className="hero-orbit hero-orbit-pink" />
          <span className="hero-orbit hero-orbit-lilac" />
          <span className="hero-side-chip hero-side-chip-voice"><i /><i /><i /><i /><b>VOICE</b></span>
          <span className="hero-side-spark hero-side-spark-left">✦</span>
        </div>
        <div className="hero-side-cluster hero-side-cluster-right">
          <span className="hero-side-chip hero-side-chip-memory"><b>MEMORY</b><i /><i /><i /></span>
          <span className="hero-orbit hero-orbit-blue" />
          <span className="hero-orbit hero-orbit-pink hero-orbit-small" />
          <span className="hero-side-spark hero-side-spark-right">♥</span>
        </div>
      </div>
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
    <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#352a3e]/80 px-6 py-8 shadow-[0_20px_50px_rgba(12,7,20,0.24)] backdrop-blur-sm md:px-9 md:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#d77aaa]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-52 w-52 rounded-full bg-[#9b8cff]/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.18em] text-[#e99cc1]">{text.journey.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-white md:text-4xl">{text.journey.title}</h2>
            <p className="mt-3 max-w-xl leading-7 text-[#dbcbdc]">{text.journey.description}</p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold tracking-[0.14em] text-[#f7e8f0]">3 STEPS</span>
        </div>
        <div className="relative mt-8 grid gap-3 md:grid-cols-3 md:gap-4">
          {text.journey.steps.map(([title, description, action, href], index) => (
            <Link key={title} href={href} className="group rounded-3xl border border-white/10 bg-[#2b2232]/70 p-5 text-left transition hover:-translate-y-1 hover:border-[#e88fbd]/60 hover:bg-[#413048] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f2a3c6]">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f08abb] to-[#a58bf2] text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(208,109,164,0.3)]">0{index + 1}</span>
                <span className="text-lg text-[#cbb1c5] transition group-hover:translate-x-1 group-hover:text-white">→</span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">{title}</h3>
              <p className="mt-3 min-h-20 leading-7 text-[#d1bfd0]">{description}</p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-[#f2a3c6]">{action}<span className="transition group-hover:translate-x-1">→</span></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  </>;
}
