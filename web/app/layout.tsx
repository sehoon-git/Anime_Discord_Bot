import type { Metadata } from "next";
import Link from "next/link";
import AuthButton from "./_components/AuthButton";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-[#171717] text-white">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#171717]/95 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
              <Link href="/" className="flex items-center gap-2 font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500">
                  AI
                </span>
                <span>Discord Anime AI</span>
              </Link>

              <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
                <Link href="/billing" className="hover:text-white">
                  요금제
                </Link>
                <Link href="/memory" className="hover:text-white">
                  기억 관리
                </Link>
                <Link href="/settings/privacy" className="hover:text-white">
                  설정
                </Link>
              </nav>

              <AuthButton />
            </div>
          </header>

          {children}

          <footer className="border-t border-zinc-800 bg-[#171717] px-6 py-10 text-sm text-zinc-500">
            <div className="mx-auto max-w-7xl">
              <p className="font-semibold text-zinc-300">Discord Anime AI</p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {footerLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="hover:text-white"
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
