import ThemeToggle from "@/app/_components/ThemeToggle";

export default function PrivacySettingsPage() {
  return (
    <main className="site-wash min-h-screen px-6 py-12 text-[#493647]">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-[#d45d91]">
          Discord Anime AI
        </p>
        <h1 className="mt-3 text-4xl font-bold">개인정보 설정</h1>
        <p className="mt-3 text-sm text-[#806579]">
          필수 동의 항목은 서비스 이용을 위해 항상 켜져 있습니다.
        </p>

        <section className="mt-8 rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-[0_16px_45px_rgba(198,135,169,0.1)]">
          <h2 className="text-lg font-bold text-[#684b60]">화면 테마</h2>
          <p className="mt-2 text-sm text-[#92768a]">편안하게 사용할 화면 모드를 선택해주세요.</p>
          <div className="mt-4">
            <ThemeToggle />
          </div>
        </section>

        <div className="mt-6 space-y-4">
          <label className="flex items-center justify-between rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-sm">
            <span>음성 데이터 처리 허용</span>
            <input type="checkbox" />
          </label>

          <label className="flex items-center justify-between rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-sm">
            <span>
              <span className="block font-semibold">
                장기기억 저장 동의 (필수)
              </span>
              <span className="mt-1 block text-sm text-[#92768a]">
                저장된 기억은 기억 관리에서 언제든 삭제할 수 있습니다.
              </span>
            </span>
            <input type="checkbox" checked disabled readOnly />
          </label>

          <label className="flex items-center justify-between rounded-3xl border border-[#f0d7e5] bg-white/80 p-5 shadow-sm">
            <span>AI API 국외 처리 동의 (필수)</span>
            <input type="checkbox" checked disabled readOnly />
          </label>
        </div>

        <button className="mt-8 rounded-full bg-blue-500 px-6 py-3 font-semibold">
          설정 저장
        </button>
      </section>
    </main>
  );
}
