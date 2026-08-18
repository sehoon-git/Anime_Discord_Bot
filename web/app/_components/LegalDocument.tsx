import { cookies } from "next/headers";
import type { LegalDoc } from "../legalDocs";
import { japaneseLegalDocuments } from "../legalJapanese";

export default async function LegalDocument({ title, effectiveDate, sections }: LegalDoc) {
  const locale = (await cookies()).get("locale")?.value;
  const ko = locale === "ko-KR";
  const ja = locale === "ja-JP";
  const japanese = ja ? japaneseLegalDocuments[title.en] : undefined;
  const contentSections = japanese?.sections ?? sections.map((section) => ko ? section.ko : section.en);
  const documentTitle = japanese?.title ?? (ko ? title.ko : title.en);
  const effectiveLabel = ko ? "시행일" : ja ? "施行日" : "Effective date";
  const reviewNote = ko ? "이 문서는 출시 전 운영자 정보와 실제 외부 제공자·처리 국가를 확인한 뒤 최종 검토해야 합니다." : ja ? "この文書は公開前に、運営者情報および実際の外部提供者・処理国を確認したうえで最終確認する必要があります。" : "Before launch, this document must be finalized after confirming the operator information and the actual external providers and processing countries.";
  return <main className="site-wash min-h-screen px-6 py-14 text-[#493647]"><article className="mx-auto max-w-4xl"><p className="text-sm text-[#92768a]">{effectiveLabel}: {effectiveDate}</p><h1 className="mt-3 text-4xl font-bold">{documentTitle}</h1><div className="mt-10 space-y-10">{contentSections.map((content, index) => <section key={content.title}><h2 className="text-2xl font-semibold">{index + 1}. {content.title}</h2><div className="mt-4 space-y-3 leading-8 text-[#684b60]">{content.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>)}</div><p className="mt-12 border-t border-[#efd8e5] pt-6 text-sm text-[#92768a]">{reviewNote}</p></article></main>;
}
