import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import Link from "next/link";
import HeaderMenu from "./_components/HeaderMenu";
import QuickControls from "./_components/QuickControls";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Voice With AI",
  description: "AI character voice chat on Discord",
  icons: {
    icon: "/voicewithai-logo.svg",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const storedLocale = (await cookies()).get("locale")?.value;
  const locale = storedLocale === "ko-KR" || storedLocale === "ja-JP" ? storedLocale : "en-US";
  const isKorean = locale === "ko-KR";
  const isJapanese = locale === "ja-JP";
  const footerLinks = isKorean
    ? [["/notice", "서비스 공지"], ["/privacy", "개인정보처리방침"], ["/terms", "서비스 이용약관"], ["/voice-policy", "음성 데이터 정책"], ["/billing", "요금제"]]
    : isJapanese
      ? [["/notice", "お知らせ"], ["/privacy", "プライバシーポリシー"], ["/terms", "利用規約"], ["/voice-policy", "音声データポリシー"], ["/billing", "料金プラン"]]
      : [["/notice", "Notices"], ["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"], ["/voice-policy", "Voice Data Policy"], ["/billing", "Plans"]];

  return (
    <html lang={isKorean ? "ko" : isJapanese ? "ja" : "en"}>
      <body data-theme="dark" className="bg-[#fff8fc] text-[#493647]">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-[#f0dce8] bg-white/85 shadow-[0_8px_30px_rgba(205,151,180,0.08)] backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 font-bold"><Image src="/voicewithai-logo.svg" alt="Voice With AI" width={36} height={36} className="h-9 w-9" priority /><span className="text-[#5b4054]">Voice With AI</span></Link>
                <nav className="flex items-center gap-5 text-sm font-semibold text-[#876b7d]"><Link href="/billing" className="hover:text-[#d45d91]">{isKorean ? "요금제" : isJapanese ? "料金プラン" : "Plans"}</Link><Link href="/dashboard" className="hover:text-[#d45d91]">{isKorean ? "대시보드" : isJapanese ? "ダッシュボード" : "Dashboard"}</Link><Link href="/support" className="hover:text-[#d45d91]">{isKorean ? "문의 게시판" : isJapanese ? "お問い合わせ" : "Support"}</Link><Link href="/characters" className="hover:text-[#d45d91]">{isKorean ? "캐릭터 설정" : isJapanese ? "キャラクター設定" : "Characters"}</Link></nav>
              </div>
              <div className="flex items-center gap-2">
                <QuickControls locale={locale} />
                <Link
                  href="/notice"
                  aria-label={isKorean ? "공지사항 보기" : isJapanese ? "お知らせを見る" : "View notices"}
                  className="header-icon-control group relative flex h-10 w-10 items-center justify-center rounded-full text-[#806579] transition hover:scale-105 hover:bg-[#fff0f7] hover:text-[#d45d91] hover:shadow-[0_6px_16px_rgba(212,93,145,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d45d91]/50"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M10 21h4" />
                  </svg>
                  <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#efcfdf] bg-[#fff8fc] px-2 py-1 text-xs font-semibold text-[#76566b] opacity-0 shadow-lg shadow-pink-200/20 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    {isKorean ? "공지사항" : isJapanese ? "お知らせ" : "Notices"}
                  </span>
                </Link>
                <HeaderMenu locale={locale} />
              </div>
            </div>
          </header>
          {children}
          <footer className="border-t border-[#f0dce8] bg-[#fff0f7] px-6 py-10 text-sm text-[#9b7f91]">
            <div className="mx-auto max-w-7xl">
              <p className="font-semibold text-[#6b4d61]">Voice With AI</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{footerLinks.map(([href, label]) => <Link key={href} href={href} className="hover:text-[#d45d91]">{label}</Link>)}</div>
              <div className="mt-6 space-y-1">{isKorean ? <><p>상호명: Voice With AI</p><p>대표자명: 준비 중 | 사업자등록번호: 준비 중</p><p>이메일: help@example.com</p></> : isJapanese ? <><p>事業者名: Voice With AI</p><p>代表者名: 準備中 | 事業者登録番号: 準備中</p><p>メール: help@example.com</p></> : <><p>Business name: Voice With AI</p><p>Representative: Coming soon | Business registration: Coming soon</p><p>Email: help@example.com</p></>}</div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
