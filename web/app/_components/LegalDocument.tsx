import { cookies } from "next/headers";
import type { LegalDoc } from "../legalDocs";

export default async function LegalDocument({ title, effectiveDate, sections }: LegalDoc) {
  const ko = (await cookies()).get("locale")?.value === "ko-KR";
  return <main className="site-wash min-h-screen px-6 py-14 text-[#493647]"><article className="mx-auto max-w-4xl"><p className="text-sm text-[#92768a]">{ko ? "시행일" : "Effective date"}: {effectiveDate}</p><h1 className="mt-3 text-4xl font-bold">{ko ? title.ko : title.en}</h1><div className="mt-10 space-y-10">{sections.map((section, index) => { const content = ko ? section.ko : section.en; return <section key={content.title}><h2 className="text-2xl font-semibold">{index + 1}. {content.title}</h2><div className="mt-4 space-y-3 leading-8 text-[#684b60]">{content.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>; })}</div><p className="mt-12 border-t border-[#efd8e5] pt-6 text-sm text-[#92768a]">{ko ? "이 문서는 출시 전 운영자 정보와 실제 외부 제공자·처리 국가를 확인한 뒤 최종 검토해야 합니다." : "Before launch, this document must be finalized after confirming the operator information and the actual external providers and processing countries."}</p></article></main>;
}
