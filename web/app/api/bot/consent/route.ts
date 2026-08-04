import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const discordUserId = searchParams.get("discordUserId");
  const apiKey = request.headers.get("x-bot-api-key");

  if (apiKey !== process.env.BOT_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
  }

  if (!discordUserId) {
    return NextResponse.json({ ok: false, error: "MISSING_DISCORD_USER_ID" }, { status: 400 });
  }

  try {
    const res = await pool.query(
      `SELECT c.consent_type 
       FROM user_consents c
       JOIN user_accounts a ON a.user_id = c.user_id
       WHERE a.provider = 'discord' AND a.provider_user_id = $1`,
      [discordUserId]
    );

    const consents = res.rows.map((r) => r.consent_type);

    return NextResponse.json({
      ok: true,
      consents,
      hasMemoryConsent: consents.includes("memory"),
    });
  } catch (error) {
    console.error("GET /api/bot/consent Error:", error);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}