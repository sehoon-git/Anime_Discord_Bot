import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import HeaderMenu from "./_components/HeaderMenu";
import QuickControls from "./_components/QuickControls";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "VoiceWithAI",
  description: "AI character voice chat on Discord",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isKorean = (await cookies()).get("locale")?.value === "ko-KR";
  const footerLinks = isKorean
    ? [["/notice", "서비스 공지"], ["/privacy", "개인정보처리방침"], ["/terms", "서비스 이용약관"], ["/voice-policy", "음성 데이터 정책"], ["/billing", "요금제"]]
    : [["/notice", "Notices"], ["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"], ["/voice-policy", "Voice Data Policy"], ["/billing", "Plans"]];

  return (
    <html lang={isKorean ? "ko" : "en"}>
      <body data-theme="dark" className="bg-[#fff8fc] text-[#493647]">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-[#f0dce8] bg-white/85 shadow-[0_8px_30px_rgba(205,151,180,0.08)] backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 font-bold"><span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f58bb6] to-[#a895f4] text-sm text-white shadow-md shadow-pink-200">AI</span><span className="text-[#5b4054]">VoiceWithAI</span></Link>
                <nav className="flex items-center gap-5 text-sm font-semibold text-[#876b7d]"><Link href="/billing" className="hover:text-[#d45d91]">{isKorean ? "요금제" : "Plans"}</Link><Link href="/dashboard" className="hover:text-[#d45d91]">{isKorean ? "대시보드" : "Dashboard"}</Link><Link href="/support" className="hover:text-[#d45d91]">{isKorean ? "문의 게시판" : "Support"}</Link><Link href="/characters" className="hover:text-[#d45d91]">{isKorean ? "캐릭터 설정" : "Characters"}</Link></nav>
              </div>
              <div className="flex items-center gap-2"><QuickControls locale={isKorean ? "ko-KR" : "en-US"} /><HeaderMenu locale={isKorean ? "ko-KR" : "en-US"} /></div>
            </div>
          </header>
          {children}
          <footer className="border-t border-[#f0dce8] bg-[#fff0f7] px-6 py-10 text-sm text-[#9b7f91]">
            <div className="mx-auto max-w-7xl">
              <p className="font-semibold text-[#6b4d61]">VoiceWithAI</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{footerLinks.map(([href, label]) => <Link key={href} href={href} className="hover:text-[#d45d91]">{label}</Link>)}</div>
              <div className="mt-6 space-y-1">{isKorean ? <><p>상호명: VoiceWithAI</p><p>대표자명: 준비 중 | 사업자등록번호: 준비 중</p><p>이메일: help@example.com</p></> : <><p>Business name: VoiceWithAI</p><p>Representative: Coming soon | Business registration: Coming soon</p><p>Email: help@example.com</p></>}</div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
