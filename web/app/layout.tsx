import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import Link from "next/link";
import { getServerSession } from "next-auth";
import HeaderMenu from "./_components/HeaderMenu";
import QuickControls from "./_components/QuickControls";
import "./globals.css";
import Providers from "./providers";
import { getMessages, toAppLocale } from "./i18n/messages";
import { authOptions } from "@/app/lib/auth";
import { isAdminEmail } from "@/app/lib/admin";

export const metadata: Metadata = {
  title: "Voice With AI",
  description: "AI character voice chat on Discord",
  icons: {
    icon: "/voicewithai-logo.svg",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const storedLocale = (await cookies()).get("locale")?.value;
  const locale = toAppLocale(storedLocale);
  const isKorean = locale === "ko-KR";
  const isJapanese = locale === "ja-JP";
  const t = getMessages(locale);
  const footerLinks = t.footer.links;
  const session = await getServerSession(authOptions);
  const showAdmin = isAdminEmail(session?.user?.email);

  return (
    <html lang={isKorean ? "ko" : isJapanese ? "ja" : "en"}>
      <body data-theme="dark" className="bg-[#fff8fc] text-[#493647]">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-[#f0dce8] bg-white/85 shadow-[0_8px_30px_rgba(205,151,180,0.08)] backdrop-blur-xl">
            <div className="site-header-content mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
              <div className="site-header-primary flex items-center gap-8">
                <Link href="/" className="site-brand flex items-center gap-2 font-bold"><Image src="/voicewithai-logo.svg" alt="Voice With AI" width={36} height={36} className="site-brand-logo h-9 w-9" priority /><span className="site-brand-label text-[#5b4054]">Voice With AI</span></Link>
                <nav className="site-primary-nav flex items-center gap-5 text-sm font-semibold text-[#876b7d]"><Link href="/billing" className="site-nav-link hover:text-[#d45d91]">{t.nav.plans}</Link><Link href="/dashboard" className="site-nav-link hover:text-[#d45d91]">{t.nav.dashboard}</Link><Link href="/support" className="site-nav-link hover:text-[#d45d91]">{t.nav.support}</Link><Link href="/characters" className="site-nav-link hover:text-[#d45d91]">{t.nav.characters}</Link></nav>
              </div>
              <div className="site-header-controls flex items-center gap-2">
                <QuickControls locale={locale} />
                <Link
                  href="/notice"
                  aria-label={t.nav.viewNotices}
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
                    {t.nav.notices}
                  </span>
                </Link>
                <HeaderMenu locale={locale} showAdmin={showAdmin} />
              </div>
            </div>
          </header>
          {children}
          <footer className="border-t border-[#f0dce8] bg-[#fff0f7] px-6 py-10 text-sm text-[#9b7f91]">
            <div className="mx-auto max-w-7xl">
              <p className="font-semibold text-[#6b4d61]">Voice With AI</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{footerLinks.map(([href, label]) => <Link key={href} href={href} className="hover:text-[#d45d91]">{label}</Link>)}</div>
              <div className="mt-6 space-y-1">{t.footer.details.map((detail) => <p key={detail}>{detail}</p>)}</div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
