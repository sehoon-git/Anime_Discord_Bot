"use client";

import Image from "next/image";
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
    story: [
      { eyebrow: "A LITTLE CLOSER", title: "A character who remembers your rhythm", description: "Small details from your conversations can stay with Seline, so the next hello feels a little more familiar.", note: "Long-term memory", bubble: "You said you liked quiet nights, right?" },
      { eyebrow: "HEAR THE MOMENT", title: "Warm replies, in a voice that reaches you", description: "When you want to hear a voice instead of reading a long message, start a gentle voice conversation right in Discord.", note: "Voice conversation", bubble: "Take your time. I am listening." },
      { eyebrow: "RIGHT WHERE YOU ARE", title: "Your conversations continue in Discord", description: "Connect once, invite the bot to your server, and begin a private, cozy conversation without changing your usual space.", note: "Discord connection", bubble: "Ready when you are ✦" },
    ],
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
    story: [
      { eyebrow: "기억하는 대화", title: "당신의 리듬을 기억하는 캐릭터", description: "대화 속 작은 취향과 이야기를 기억해 다음 인사가 조금 더 익숙하고 자연스럽게 이어집니다.", note: "장기기억", bubble: "조용한 밤을 좋아한다고 했었죠?" },
      { eyebrow: "목소리로 전하는 순간", title: "글보다 목소리가 필요한 날에도", description: "긴 문장을 읽기보다 목소리를 듣고 싶은 날, Discord 안에서 포근한 음성 대화를 바로 시작할 수 있어요.", note: "음성 대화", bubble: "천천히 말해도 괜찮아요. 듣고 있을게요." },
      { eyebrow: "늘 쓰던 공간에서", title: "대화는 Discord 안에서 자연스럽게 이어져요", description: "한 번만 연결하고 서버에 봇을 초대하면, 익숙한 Discord 공간에서 나만의 대화를 이어갈 수 있어요.", note: "Discord 연동", bubble: "준비되면 언제든 불러주세요 ✦" },
    ],
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
    story: [
      { eyebrow: "記憶する会話", title: "あなたのペースを覚えるキャラクター", description: "会話の中の小さな好みや出来事を覚えて、次のあいさつがもっと自然で親しみやすくなります。", note: "長期記憶", bubble: "静かな夜が好きだと話していましたよね？" },
      { eyebrow: "声で届くひととき", title: "文字より声がほしい日にも", description: "長い文章を読むより声を聞きたいときは、Discordからやさしい音声会話をすぐに始められます。", note: "音声会話", bubble: "ゆっくりで大丈夫です。聞いていますよ。" },
      { eyebrow: "いつもの場所で", title: "会話はDiscordの中で自然に続きます", description: "一度連携してボットをサーバーに招待すれば、いつものDiscordで自分だけの会話を続けられます。", note: "Discord連携", bubble: "準備ができたら、いつでも呼んでくださいね ✦" },
    ],
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

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-scroll-reveal]");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
      { threshold: 0.18 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

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
        <h1 className="min-h-[4.5rem] whitespace-pre-line text-5xl font-extrabold leading-[1.18] tracking-[-0.03em] text-[#5b4054] md:min-h-[6.25rem] md:text-7xl">{text.titleLines[lineIndex].slice(0, visibleCount)}<span className="type-caret" aria-hidden="true" /></h1>
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
    <section id="features" className="home-story mx-auto max-w-6xl px-6 pb-28 pt-4 md:pb-40">
      <div className="home-story-intro scroll-reveal text-center" data-scroll-reveal>
        <p className="text-xs font-bold tracking-[0.18em] text-[#e99cc1]">{text.journey.eyebrow}</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-[-0.04em] text-white md:text-5xl">{text.journey.title}</h2>
        <p className="mx-auto mt-5 max-w-xl leading-7 text-[#d9cadb]">{text.journey.description}</p>
      </div>
      <div className="mt-16 space-y-20 md:mt-24 md:space-y-32">
        {text.story.map((story, index) => (
          <article key={story.title} data-scroll-reveal className={`scroll-reveal home-story-row ${index % 2 ? "home-story-row-reverse" : ""}`}>
            <div className="home-story-copy">
              <span className="home-story-index">0{index + 1}</span>
              <p className="mt-6 text-xs font-bold tracking-[0.18em] text-[#ee9fc3]">{story.eyebrow}</p>
              <h3 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-white md:text-5xl">{story.title}</h3>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#d9cadb] md:text-lg">{story.description}</p>
              <span className="mt-7 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-[#f8eaf2]">{story.note}</span>
            </div>
            <div className={`home-story-scene home-story-scene-${index + 1}`} aria-hidden="true">
              <span className="home-story-orb home-story-orb-one" /><span className="home-story-orb home-story-orb-two" /><span className="home-story-orb home-story-orb-three" />
              <div className="home-story-panel">
                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-[#f58bb6] to-[#a895f4] text-xs font-bold text-white">AI</span><span className="text-sm font-bold text-white">Seline</span><span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#6fd3b0] shadow-[0_0_0_5px_rgba(111,211,176,0.12)]" /></div>
                <div className="space-y-4 px-5 py-7"><p className="home-story-bubble home-story-bubble-ai">{story.bubble}</p><p className="home-story-bubble home-story-bubble-user">♥</p></div>
              </div>
              <span className="home-story-float home-story-float-heart">♥</span><span className="home-story-float home-story-float-star">✦</span>
            </div>
          </article>
        ))}
      </div>
      <div className="scroll-reveal mt-24 text-center" data-scroll-reveal><StartButton locale={locale} /></div>
    </section>
  </>;
}
