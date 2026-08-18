import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import AutoGoogleSignIn from "@/app/_components/AutoGoogleSignIn";
import AssistantSettings from "@/app/_components/AssistantSettings";
import CharacterManager from "@/app/_components/CharacterManager";
import { authOptions } from "@/app/lib/auth";
import { webPool } from "@/app/lib/db";
import { upsertUser } from "@/app/lib/users";
import { getMessages, toAppLocale } from "@/app/i18n/messages";

export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const session = await getServerSession(authOptions);
  const locale = toAppLocale((await cookies()).get("locale")?.value);
  const t = getMessages(locale).characters;
  if (!session?.user?.email) return <AutoGoogleSignIn callbackUrl="/characters" locale={locale} />;

  const userId = await upsertUser(session.user.email, session.user.name);
  await webPool.query(`CREATE TABLE IF NOT EXISTS user_character_settings (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    selected_character_id TEXT NOT NULL DEFAULT 'seline',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const result = await webPool.query<{ selected_character_id: string }>(
    "SELECT selected_character_id FROM user_character_settings WHERE user_id = $1 LIMIT 1",
    [userId],
  );

  return <main className="site-wash min-h-screen px-6 py-12 text-[#493647]"><section className="mx-auto max-w-5xl"><p className="text-sm font-semibold text-[#d45d91]">Voice With AI</p><h1 className="mt-3 text-4xl font-extrabold">{t.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#806579]">{t.description}</p><section className="mt-8"><CharacterManager initialCharacterId={result.rows[0]?.selected_character_id ?? "seline"} locale={locale} /></section><AssistantSettings locale={locale} title={t.settings} /></section></main>;
}
