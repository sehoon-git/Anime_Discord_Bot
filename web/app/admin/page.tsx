import { notFound } from "next/navigation";
import { requireAdminEmail } from "@/app/lib/admin";
import AdminModerationConsole from "@/app/_components/AdminModerationConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) notFound();
  return <main className="site-wash min-h-screen px-5 py-10 text-[#493647]"><div className="mx-auto max-w-5xl"><p className="text-sm font-bold text-[#d45d91]">운영진 전용</p><h1 className="mt-2 text-3xl font-extrabold">사용자 제재 관리</h1><p className="mt-3 text-sm leading-6 text-[#806579]">이 페이지의 모든 처리 내용은 기록됩니다. 계정 제재를 우선 사용하고, IP 제재는 반복 악용이 확인된 경우에만 사용하세요.</p><AdminModerationConsole adminEmail={adminEmail} /></div></main>;
}
