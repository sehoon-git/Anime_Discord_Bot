import { NextResponse } from "next/server";
import { webPool } from "@/app/lib/db";
import { upsertVoiceConsent } from "@/app/lib/operations";

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const legacy = request.headers.get("x-bot-api-key");
  return Boolean(process.env.BOT_SECRET_KEY &&
    (bearer === process.env.BOT_SECRET_KEY || legacy === process.env.BOT_SECRET_KEY));
}

async function resolveUserId(discordUserId: string) {
  const result = await webPool.query<{ user_id: string }>(
    `SELECT user_id::text FROM user_accounts
     WHERE provider = 'discord' AND provider_user_id = $1 LIMIT 1`,
    [discordUserId],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (typeof body?.discordUserId !== "string" || typeof body?.enabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const userId = await resolveUserId(body.discordUserId);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    await upsertVoiceConsent({
      userId,
      speechRecognitionAllowed: body.enabled,
      voiceStorageAllowed: false,
    });

    return NextResponse.json({ ok: true, allowed: body.enabled });
  } catch (error) {
    console.error("POST /api/bot/voice-consent Error:", error);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
