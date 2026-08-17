import { cookies } from "next/headers";
import HomeHero from "./_components/HomeHero";

export default async function Home() {
  const storedLocale = (await cookies()).get("locale")?.value;
  const locale = storedLocale === "ko-KR" ? "ko" : storedLocale === "ja-JP" ? "ja" : "en";

  return (
    <main className="site-wash min-h-screen text-[#493647]">
      <HomeHero locale={locale} />
    </main>
  );
}
