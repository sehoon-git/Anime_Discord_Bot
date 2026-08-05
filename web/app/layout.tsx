import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import HeaderMenu from "./_components/HeaderMenu";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Discord Anime AI",
  description: "AI 캐릭터 음성 대화 Discord 봇 서비스",
};

const footerLinks = [
  { href: "/notice", label: "서비스 공지" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "서비스 이용약관" },
  { href: "/voice-policy", label: "음성 데이터 정책" },
  { href: "/billing", label: "요금제" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await cookies()).get("locale")?.value === "ko-KR" ? "ko" : "en";

  return (
    <html lang={locale}>
      <body className="bg-[#fff8fc] text-[#493647]">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-[#f0dce8] bg-white/85 shadow-[0_8px_30px_rgba(205,151,180,0.08)] backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 font-bold">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f58bb6] to-[#a895f4] text-sm text-white shadow-md shadow-pink-200">
                    AI
                  </span>
                  <span className="text-[#5b4054]">Discord Anime AI</span>
                </Link>

                <nav className="flex items-center text-sm font-semibold text-[#876b7d]">
                  <Link href="/billing" className="hover:text-[#d45d91]">
                    {locale === "ko" ? "요금제" : "Plans"}
                  </Link>
                </nav>
              </div>

              <HeaderMenu locale={locale === "ko" ? "ko-KR" : "en-US"} />
            </div>
          </header>

          {children}

          <footer className="border-t border-[#f0dce8] bg-[#fff0f7] px-6 py-10 text-sm text-[#9b7f91]">
            <div className="mx-auto max-w-7xl">
              <p className="font-semibold text-[#6b4d61]">Discord Anime AI</p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {footerLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="hover:text-[#d45d91]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="mt-6 space-y-1">
                <p>상호명: Discord Anime AI</p>
                <p>대표자명: 홍길동 | 사업자등록번호: 준비 중</p>
                <p>이메일: help@example.com</p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
