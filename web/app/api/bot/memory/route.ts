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
      `SELECT m.id, m.content, m.created_at
       FROM user_memories m
       JOIN user_accounts a ON a.user_id = m.user_id
       WHERE a.provider = 'discord' AND a.provider_user_id = $1
       ORDER BY m.created_at DESC LIMIT 10`,
      [discordUserId]
    );

    return NextResponse.json({ ok: true, memories: res.rows });
  } catch (error) {
    console.error("GET /api/bot/memory Error:", error);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-bot-api-key");

  if (apiKey !== process.env.BOT_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
  }

  try {
    const { discordUserId, content } = await request.json();

    const userRes = await pool.query(
      `SELECT user_id FROM user_accounts WHERE provider = 'discord' AND provider_user_id = $1`,
      [discordUserId]
    );

    const userId = userRes.rows[0]?.user_id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const insertRes = await pool.query(
      `INSERT INTO user_memories (user_id, content, source) VALUES ($1, $2, 'conversation') RETURNING id`,
      [userId, content]
    );

    return NextResponse.json({ ok: true, memoryId: insertRes.rows[0].id });
  } catch (error) {
    console.error("POST /api/bot/memory Error:", error);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}