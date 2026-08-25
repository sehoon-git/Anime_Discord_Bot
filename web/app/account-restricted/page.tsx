import Link from "next/link";

export default async function AccountRestrictedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; expiresAt?: string }>;
}) {
  const { reason, expiresAt } = await searchParams;
  const expiry = expiresAt ? new Date(expiresAt) : null;
  const expiryText = expiry && !Number.isNaN(expiry.getTime()) ? expiry.toLocaleString("ko-KR") : "영구";

  return (
    <main className="site-wash min-h-screen px-6 py-16 text-[#493647]">
      <section className="mx-auto max-w-xl rounded-3xl border border-[#efb9d1] bg-white/90 p-8 shadow-[0_20px_60px_rgba(198,135,169,0.2)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e86d9f] to-[#a895f4] text-2xl font-black text-white shadow-lg shadow-pink-200/50">!</span>
        <p className="mt-6 text-sm font-semibold text-[#d45d91]">Voice With AI</p>
        <h1 className="mt-3 text-3xl font-extrabold text-[#5b4054]">서비스 이용이 제한되었습니다</h1>
        <p className="mt-4 leading-7 text-[#806579]">현재 계정은 로그아웃되었습니다. 제재 내용에 이의가 있다면 문의 게시판을 통해 알려주세요.</p>
        <dl className="mt-6 space-y-4 rounded-2xl border border-[#f0d7e5] bg-[#fff8fc] p-5 text-sm">
          <div><dt className="font-bold text-[#5b4054]">제재 사유</dt><dd className="mt-1 whitespace-pre-wrap leading-6 text-[#806579]">{reason || "서비스 운영 정책에 따른 이용 제한"}</dd></div>
          <div className="border-t border-[#f0dce8] pt-4"><dt className="font-bold text-[#5b4054]">제재 기간</dt><dd className="mt-1 text-[#806579]">{expiryText}</dd></div>
        </dl>
        <Link href="/support" className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#ffb4d5] px-6 py-3 text-sm font-extrabold text-white shadow-[0_12px_26px_rgba(206,89,151,0.36)]" style={{ background: "linear-gradient(90deg, #dc5f98 0%, #9c78e8 100%)" }}>
          문의 게시판으로 이동하기
        </Link>
      </section>
    </main>
  );
}
