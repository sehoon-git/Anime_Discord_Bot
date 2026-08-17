"use client";

import { useEffect, useState } from "react";

type SupportedLocale = "en-US" | "ko-KR" | "ja-JP";

type DashboardOnboardingProps = {
  userId: string | number;
  locale: SupportedLocale;
  discordLinked: boolean;
  className?: string;
};

type GuideCopy = {
  trigger: string;
  eyebrow: string;
  title: string;
  description: string;
  note: string;
  close: string;
  linked: string;
  connect: string;
  invite: string;
  inviteLocked: string;
  steps: Array<{ title: string; description: string }>;
};

const copy: Record<SupportedLocale, GuideCopy> = {
  "ko-KR": {
    trigger: "이용방법 다시 보기",
    eyebrow: "처음 오셨나요?",
    title: "Voice With AI 시작하기",
    description: "아래 2단계만 완료하면 Discord에서 AI 캐릭터와 음성 대화를 시작할 수 있어요.",
    note: "이 안내는 언제든 대시보드에서 다시 열 수 있습니다.",
    close: "닫기",
    linked: "연결 완료",
    connect: "Discord 계정 연동하기",
    invite: "봇 초대하기",
    inviteLocked: "계정 연동 후 가능",
    steps: [
      { title: "Discord 계정 연동", description: "웹 계정과 Discord 계정을 연결해 봇 사용 권한을 확인하세요." },
      { title: "봇 초대", description: "연동한 뒤 AI 캐릭터를 사용할 Discord 서버로 봇을 초대하세요." },
    ],
  },
  "ja-JP": {
    trigger: "使い方をもう一度見る",
    eyebrow: "はじめての方へ",
    title: "Voice With AI をはじめよう",
    description: "次の2ステップを完了すると、Discord で AI キャラクターとの音声会話を始められます。",
    note: "このガイドはいつでもダッシュボードから開けます。",
    close: "閉じる",
    linked: "連携済み",
    connect: "Discord アカウントを連携",
    invite: "ボットを招待",
    inviteLocked: "連携後に利用可能",
    steps: [
      { title: "Discord アカウントを連携", description: "Web アカウントと Discord を連携して、ボットの利用権限を確認します。" },
      { title: "ボットを招待", description: "連携後、AI キャラクターを使う Discord サーバーにボットを招待します。" },
    ],
  },
  "en-US": {
    trigger: "View getting started guide",
    eyebrow: "New here?",
    title: "Get started with Voice With AI",
    description: "Complete these two steps to start voice conversations with AI characters on Discord.",
    note: "You can reopen this guide anytime from the dashboard.",
    close: "Close",
    linked: "Connected",
    connect: "Connect Discord account",
    invite: "Invite the bot",
    inviteLocked: "Connect your account first",
    steps: [
      { title: "Connect Discord", description: "Connect your web and Discord accounts to verify bot access." },
      { title: "Invite the bot", description: "After connecting, invite the bot to the Discord server where you want to use it." },
    ],
  },
};

export default function DashboardOnboarding({
  userId,
  locale,
  discordLinked,
  className = "mt-3",
}: DashboardOnboardingProps) {
  const [open, setOpen] = useState(false);
  const guide = copy[locale] ?? copy["en-US"];
  const storageKey = `voice-with-ai-dashboard-guide-v1:${userId}`;

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) !== "complete") {
      const timer = window.setTimeout(() => setOpen(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, [storageKey]);

  const closeGuide = () => {
    window.localStorage.setItem(storageKey, "complete");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${className} rounded-full border border-[#e3bfd3] bg-white/70 px-4 py-2 text-sm font-semibold text-[#76566b] transition hover:-translate-y-0.5 hover:bg-white hover:text-[#d45d91]`}
      >
        {guide.trigger} →
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2030]/55 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="getting-started-title"
        >
          <section className="w-full max-w-2xl rounded-3xl border border-[#f3cde0] bg-[#fffafb] p-6 text-[#493647] shadow-[0_28px_90px_rgba(45,23,41,0.38)] sm:p-8">
            <p className="text-sm font-bold text-[#d45d91]">{guide.eyebrow}</p>
            <h2 id="getting-started-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
              {guide.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#806579]">{guide.description}</p>

            <ol className="mt-6 space-y-3">
              {guide.steps.map((step, index) => {
                const stepAction =
                  index === 0 ? (
                    discordLinked ? (
                      <span className="inline-flex min-h-10 min-w-40 items-center justify-center rounded-full border border-[#a9dfbf] bg-[#e7f8ef] px-4 py-2 text-xs font-bold text-[#2f815d]">
                        {guide.linked}
                      </span>
                    ) : (
                      <a
                        href="/api/discord/connect"
                        className="inline-flex min-h-10 min-w-40 items-center justify-center rounded-full border border-[#9ea8ff] bg-[#596cf5] px-4 py-2 text-xs font-bold text-white shadow-[0_8px_20px_rgba(89,108,245,0.28)] transition hover:-translate-y-0.5 hover:bg-[#485be4] hover:shadow-[0_10px_24px_rgba(89,108,245,0.38)]"
                      >
                        {guide.connect} <span aria-hidden="true">→</span>
                      </a>
                    )
                  ) : index === 1 ? (
                    discordLinked ? (
                      <a
                        href="/api/discord/bot-invite"
                        className="inline-flex min-h-10 min-w-40 items-center justify-center rounded-full border border-[#9ea8ff] bg-[#596cf5] px-4 py-2 text-xs font-bold text-white shadow-[0_8px_20px_rgba(89,108,245,0.28)] transition hover:-translate-y-0.5 hover:bg-[#485be4] hover:shadow-[0_10px_24px_rgba(89,108,245,0.38)]"
                      >
                        {guide.invite} <span aria-hidden="true">→</span>
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="inline-flex min-h-10 min-w-40 items-center justify-center rounded-full border border-dashed border-[#cdbccb] bg-[#f7f1f5] px-4 py-2 text-xs font-bold text-[#947b8d]"
                      >
                        {guide.inviteLocked}
                      </span>
                    )
                  ) : null;

                return (
                  <li key={step.title} className="flex gap-3 rounded-2xl border border-[#f0d7e5] bg-white p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e97eab] to-[#9a7cf0] text-xs font-extrabold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-5 text-[#806579]">{step.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center">{stepAction}</div>
                  </li>
                );
              })}
            </ol>

            <p className="mt-5 text-xs text-[#92768a]">{guide.note}</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={closeGuide} className="rounded-full bg-gradient-to-r from-[#e97eab] to-[#9a7cf0] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(191,105,160,0.28)] transition hover:-translate-y-0.5">
                {guide.close}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
