import { cookies } from "next/headers";
import HomeHero from "./_components/HomeHero";

export default async function Home() {
  const locale = (await cookies()).get("locale")?.value === "ko-KR" ? "ko" : "en";

  return (
    <main className="site-wash min-h-screen text-[#493647]">
      <HomeHero locale={locale} />
    </main>
  );
}
