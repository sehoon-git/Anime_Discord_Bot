import Link from "next/link";

export default async function AccountRestrictedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; expiresAt?: string }>;
}) {
  const { reason, expiresAt } = await searchParams;
  const expiry = expiresAt ? new Date(expiresAt) : null;
  const expiryText = expiry && !Number.isNaN(expiry.getTime()) ? expiry.toLocaleString("ko-KR") : "별도 해제 전까지";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#251d30] px-5 py-12 text-white sm:px-8 sm:py-20">
      <div aria-hidden="true" className="absolute -left-36 top-8 h-80 w-80 rounded-full bg-[#e86d9f]/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#9c78e8]/25 blur-3xl" />
      <section className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-[#ed7cad] to-[#9c78e8] text-2xl font-black shadow-[0_14px_30px_rgba(224,100,161,0.32)]">!</div>
            <p className="mt-7 text-sm font-bold tracking-[0.16em] text-[#f3a8c9]">VOICE WITH AI · ACCOUNT NOTICE</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">서비스 이용이 제한되었습니다</h1>
            <p className="mt-5 max-w-xl leading-7 text-[#e8dce8]">현재 계정에서는 서비스 기능을 이용할 수 없습니다. 다만, 제재 내용에 이의가 있거나 확인이 필요하다면 언제든 문의 게시판을 이용해 알려주세요.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/12 bg-black/10 p-5"><p className="text-xs font-bold tracking-wider text-[#d8b8ca]">제재 사유</p><p className="mt-2 whitespace-pre-wrap leading-6 text-white">{reason || "서비스 운영 정책에 따른 이용 제한"}</p></div>
              <div className="rounded-2xl border border-white/12 bg-black/10 p-5"><p className="text-xs font-bold tracking-wider text-[#d8b8ca]">이용 제한 기간</p><p className="mt-2 leading-6 text-white">{expiryText}</p></div>
            </div>
            <Link href="/support" className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#ffc0dc] px-6 py-4 text-base font-extrabold text-white shadow-[0_14px_30px_rgba(224,100,161,0.34)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 sm:w-auto" style={{ background: "linear-gradient(90deg, #dc5f98 0%, #9c78e8 100%)" }}>
              문의 게시판으로 이동하기 <span aria-hidden="true">→</span>
            </Link>
            <p className="mt-4 text-xs leading-5 text-[#d8b8ca]">문의 게시판은 제재 여부와 관계없이 이용할 수 있습니다.</p>
          </div>
          <aside className="border-t border-white/12 bg-black/10 p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
            <p className="text-sm font-bold text-[#f3a8c9]">이의 제기 안내</p><h2 className="mt-3 text-2xl font-extrabold text-white">확인을 도와드릴게요</h2>
            <ol className="mt-7 space-y-5">
              {[["01", "문의 게시판 열기", "아래 버튼을 눌러 Discord 문의 게시판으로 이동합니다."], ["02", "상황 설명하기", "사용한 계정과 제재 사유에 대한 의견을 간단히 남겨주세요."], ["03", "운영진 검토", "운영진이 기록을 확인한 뒤 필요한 경우 제재를 조정합니다."]].map(([number, title, description]) => <li key={number} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-extrabold text-[#f3a8c9]">{number}</span><div><p className="font-bold text-white">{title}</p><p className="mt-1 text-sm leading-6 text-[#d8c9d8]">{description}</p></div></li>)}
            </ol>
          </aside>
        </div>
      </section>
    </main>
  );
}
