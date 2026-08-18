"use client";

import { useEffect, useState } from "react";
import { getMessages, type AppLocale } from "@/app/i18n/messages";

type DashboardOnboardingProps = {
  userId: string | number;
  locale: AppLocale;
  discordLinked: boolean;
  className?: string;
};

export default function DashboardOnboarding({
  userId,
  locale,
  discordLinked,
  className = "mt-3",
}: DashboardOnboardingProps) {
  const [open, setOpen] = useState(false);
  const guide = getMessages(locale).onboarding;
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
