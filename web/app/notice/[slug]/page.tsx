import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { noticeCategoryLabel, notices } from "@/app/lib/notices";

export function generateStaticParams() {
  return notices.map(({ slug }) => ({ slug }));
}

export default async function NoticeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const notice = notices.find((item) => item.slug === slug);
  if (!notice) notFound();

  const storedLocale = (await cookies()).get("locale")?.value;
  const language = storedLocale === "ko-KR" ? "ko" : storedLocale === "ja-JP" ? "ja" : "en";
  const ko = language === "ko";
  const ja = language === "ja";

  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]">
    <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-[#f0d7e5] bg-white/85 shadow-[0_20px_60px_rgba(198,135,169,0.15)]">
      <div className="border-b border-[#f0dce8] bg-gradient-to-br from-[#fff5fa] via-white to-[#f3f0ff] px-7 py-8 sm:px-10">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#fff0f7] px-2.5 py-1 text-xs font-extrabold text-[#d45d91]">{noticeCategoryLabel[notice.category][language]}</span><time className="text-xs font-semibold text-[#ad8fa1]">{notice.publishedAt}</time></div>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-[#5b4054]">{notice.title[language]}</h1>
      </div>
      <div className="px-7 py-8 sm:px-10"><div className="space-y-5 leading-8 text-[#76566b]">{notice.content[language].map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        <Link href="/notice" className="mt-10 inline-flex rounded-full border border-[#efb2cd] bg-white px-5 py-2.5 text-sm font-bold text-[#a4577e] transition hover:-translate-y-0.5 hover:bg-[#fff0f7]">← {ko ? "공지사항 목록" : ja ? "お知らせ一覧" : "All notices"}</Link>
      </div>
    </article>
  </main>;
}
