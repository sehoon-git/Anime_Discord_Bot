import Link from "next/link";
import { cookies } from "next/headers";
import { noticeCategoryLabel, notices } from "@/app/lib/notices";

export default async function NoticePage() {
  const ko = (await cookies()).get("locale")?.value !== "en-US";

  return <main className="site-wash min-h-screen px-6 py-16 text-[#493647]">
    <section className="mx-auto max-w-3xl">
      <p className="text-sm font-bold text-[#d45d91]">Voice With AI</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-[#5b4054]">{ko ? "공지사항" : "Notices"}</h1>
      <p className="mt-4 leading-7 text-[#806579]">{ko ? "서비스 업데이트, 이벤트, 점검 일정과 운영팀의 중요한 안내를 확인하세요." : "Check service updates, events, maintenance schedules, and important messages from our team."}</p>

      <div className="mt-8 overflow-hidden rounded-3xl border border-[#f0d7e5] bg-white/80 shadow-[0_18px_50px_rgba(198,135,169,0.13)]">
        {notices.map((notice) => <Link key={notice.slug} href={`/notice/${notice.slug}`} className="group flex items-center gap-4 border-b border-[#f0dce8] px-6 py-5 transition last:border-b-0 hover:bg-[#fff6fa]">
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-[#f5a4c6] via-[#d889c4] to-[#a895f4] text-xl font-extrabold text-white shadow-[0_8px_18px_rgba(205,117,173,0.28)] sm:flex" aria-hidden="true">!</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#fff0f7] px-2.5 py-1 text-xs font-extrabold text-[#d45d91]">{noticeCategoryLabel[notice.category][ko ? "ko" : "en"]}</span><time className="text-xs font-semibold text-[#ad8fa1]">{notice.publishedAt}</time></div>
            <h2 className="mt-2 text-base font-extrabold text-[#5b4054] group-hover:text-[#d45d91]">{notice.title[ko ? "ko" : "en"]}</h2>
            <p className="mt-1 truncate text-sm text-[#92768a]">{notice.summary[ko ? "ko" : "en"]}</p>
          </div>
          <span className="text-xl text-[#c397ad] transition group-hover:translate-x-1 group-hover:text-[#d45d91]" aria-hidden="true">›</span>
        </Link>)}
      </div>
      <p className="mt-5 text-sm text-[#92768a]">{ko ? "이벤트와 운영 안내는 이 목록에 계속 추가됩니다." : "Events and operational updates will continue to be added here."}</p>
    </section>
  </main>;
}
