import AccountDeletionButton from "@/app/_components/AccountDeletionButton";

export default function PrivacySettingsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <section className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">개인정보 설정</h1>

        <div className="mt-8 space-y-4">
          <label className="flex justify-between rounded-xl bg-[#202020] p-5">
            <span>음성 데이터 처리 허용</span>
            <input type="checkbox" />
          </label>

          <label className="flex justify-between rounded-xl bg-[#202020] p-5">
            <span>장기기억 저장 허용</span>
            <input type="checkbox" />
          </label>

          <label className="flex justify-between rounded-xl bg-[#202020] p-5">
            <span>AI API 국외 처리 동의</span>
            <input type="checkbox" defaultChecked />
          </label>
        </div>

        <button className="mt-8 rounded-full bg-blue-500 px-6 py-3 font-semibold">
          설정 저장
        </button>
        <AccountDeletionButton />
      </section>
    </main>
  );
}
