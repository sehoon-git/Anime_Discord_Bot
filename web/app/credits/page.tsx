import Link from "next/link";
import { cookies } from "next/headers";
import { toAppLocale } from "@/app/i18n/messages";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const locale = toAppLocale((await cookies()).get("locale")?.value);
  const copy = locale === "ja-JP"
    ? { eyebrow: "追加利用クレジット", title: "もっと会話したいときのために", description: "月間プランの利用量を使い切ったあとも会話を続けられるよう、クレジットチャージ機能を準備しています。", status: "クレジットチャージ機能を準備中", back: "ダッシュボードへ戻る" }
    : locale === "en-US"
      ? { eyebrow: "Extra-use credits", title: "For when you want to keep talking", description: "We are preparing credit top-ups so you can continue conversations after using your monthly plan allowance.", status: "Credit top-ups are coming soon", back: "Back to dashboard" }
      : { eyebrow: "추가 이용 크레딧", title: "더 대화하고 싶은 순간을 위해", description: "월간 플랜 이용량을 모두 사용한 뒤에도 대화를 이어갈 수 있도록 크레딧 충전 기능을 준비하고 있습니다.", status: "크레딧 충전 기능 준비 중", back: "대시보드로 돌아가기" };

  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]"><section className="mx-auto max-w-2xl rounded-3xl border border-[#f0d7e5] bg-white/80 p-8 text-center shadow-[0_20px_60px_rgba(198,135,169,0.16)]"><p className="text-sm font-bold text-[#d45d91]">{copy.eyebrow}</p><div className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-[#ef8fba] to-[#a895f4] text-3xl text-white">✦</div><h1 className="mt-5 text-3xl font-extrabold text-[#5b4054]">{copy.title}</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#92768a]">{copy.description}</p><p className="mt-6 rounded-2xl border border-[#efd8e5] bg-[#fffafd] px-4 py-3 text-sm font-bold text-[#a4577e]">{copy.status}</p><Link href="/dashboard" className="mt-7 inline-flex rounded-2xl bg-gradient-to-r from-[#ef8fba] to-[#a895f4] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5">{copy.back}</Link></section></main>;
}
