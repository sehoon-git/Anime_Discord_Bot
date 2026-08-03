type Section = {
  title: string;
  body: string[];
};

type LegalDocumentProps = {
  title: string;
  effectiveDate: string;
  sections: Section[];
};

export default function LegalDocument({
  title,
  effectiveDate,
  sections,
}: LegalDocumentProps) {
  return (
    <main className="min-h-screen bg-black px-6 py-14 text-white">
      <article className="mx-auto max-w-4xl">
        <p className="text-sm text-zinc-400">발효일: {effectiveDate}</p>
        <h1 className="mt-3 text-4xl font-bold">{title}</h1>

        <div className="mt-10 space-y-10">
          {sections.map((section, index) => (
            <section key={section.title}>
              <h2 className="text-2xl font-semibold">
                {index + 1}. {section.title}
              </h2>

              <div className="mt-4 space-y-3 leading-8 text-zinc-300">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
          본 문서는 서비스 출시 전 법률 전문가의 검토를 거쳐 수정될 수 있습니다.
        </p>
      </article>
    </main>
  );
}