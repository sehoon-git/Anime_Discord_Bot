import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { webPool } from "@/app/lib/db";
import { upsertUser } from "@/app/lib/users";

const AVAILABLE_CHARACTER_IDS = new Set(["seline"]);

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  if (!AVAILABLE_CHARACTER_IDS.has(characterId)) {
    return NextResponse.json({ ok: false, error: "CHARACTER_UNAVAILABLE" }, { status: 400 });
  }

  const userId = await upsertUser(session.user.email, session.user.name);
  await webPool.query(`CREATE TABLE IF NOT EXISTS user_character_settings (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    selected_character_id TEXT NOT NULL DEFAULT 'seline',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await webPool.query(
    `INSERT INTO user_character_settings (user_id, selected_character_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET selected_character_id = EXCLUDED.selected_character_id, updated_at = NOW()`,
    [userId, characterId],
  );

  return NextResponse.json({ ok: true, selectedCharacterId: characterId });
}
