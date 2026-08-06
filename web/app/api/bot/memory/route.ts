import { NextResponse } from "next/server";
import { botPool, webPool } from "@/app/lib/db";
import { getMissingRequiredConsents } from "@/app/lib/consent";

async function resolveUserId(discordUserId: string) {
  const result = await webPool.query<{ user_id: string }>(
    `
    SELECT users.id::text AS user_id
    FROM users
    JOIN user_accounts ON user_accounts.user_id = users.id
    WHERE user_accounts.provider = 'discord'
      AND user_accounts.provider_user_id = $1
    LIMIT 1
    `,
    [discordUserId],
  );

  return result.rows[0]?.user_id ?? null;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
}

function isAuthorizedBot(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
  const apiKey = request.headers.get("x-bot-api-key");
  return Boolean(
    process.env.BOT_SECRET_KEY &&
      (bearer === process.env.BOT_SECRET_KEY || apiKey === process.env.BOT_SECRET_KEY),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const discordUserId = searchParams.get("discordUserId");
  if (!isAuthorizedBot(request)) {
    return unauthorized();
  }

  if (!discordUserId) {
    return NextResponse.json({ ok: false, error: "MISSING_DISCORD_USER_ID" }, { status: 400 });
  }

  try {
    const userId = await resolveUserId(discordUserId);

    if (!userId) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const missingConsents = await getMissingRequiredConsents(userId);
    if (missingConsents.length > 0) {
      return NextResponse.json(
        { ok: false, error: "REQUIRED_CONSENT_MISSING", missingConsents },
        { status: 403 },
      );
    }

    const result = await botPool.query(
      `
      SELECT id::text, content, source, confidence, is_pinned, created_at, expires_at
      FROM user_memories
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT 10
      `,
      [userId],
    );

    return NextResponse.json({
      ok: true,
      memoryAllowed: true,
      memories: result.rows,
    });
  } catch (error) {
    console.error("GET /api/bot/memory Error:", error);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedBot(request)) {
    return unauthorized();
  }

  try {
    const { discordUserId, content } = await request.json();

    if (
      typeof discordUserId !== "string" ||
      typeof content !== "string" ||
      !discordUserId.trim() ||
      !content.trim()
    ) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const userId = await resolveUserId(discordUserId);

    if (!userId) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const missingConsents = await getMissingRequiredConsents(userId);
    if (missingConsents.length > 0) {
      return NextResponse.json(
        { ok: false, error: "REQUIRED_CONSENT_MISSING", missingConsents },
        { status: 403 },
      );
    }

    const insertRes = await botPool.query(
      `
      INSERT INTO user_memories (user_id, content, source, expires_at, updated_at)
      VALUES ($1, $2, 'conversation', NOW() + (COALESCE((SELECT retention_days FROM memory_settings WHERE user_id = $1), 30) * INTERVAL '1 day'), NOW())
      RETURNING id::text
      `,
      [userId, content.trim()],
    );

    return NextResponse.json({ ok: true, memoryId: insertRes.rows[0].id });
  } catch (error) {
    console.error("POST /api/bot/memory Error:", error);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAuthorizedBot(request)) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const discordUserId = typeof body?.discordUserId === "string" ? body.discordUserId.trim() : "";
    const memoryId = typeof body?.memoryId === "string" ? body.memoryId.trim() : "";
    const pinned = typeof body?.pinned === "boolean" ? body.pinned : null;

    if (!discordUserId || !memoryId || pinned === null) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const userId = await resolveUserId(discordUserId);
    if (!userId) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

    const missingConsents = await getMissingRequiredConsents(userId);
    if (missingConsents.length > 0) {
      return NextResponse.json(
        { ok: false, error: "REQUIRED_CONSENT_MISSING", missingConsents },
        { status: 403 },
      );
    }

    const result = await botPool.query(
      `UPDATE user_memories SET is_pinned = $3, updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [userId, memoryId, pinned],
    );

    if (result.rowCount) {
      await botPool.query(
        `INSERT INTO memory_audit_events (memory_id, user_id, action)
         VALUES ($1, $2, $3)`,
        [memoryId, userId, pinned ? "pinned" : "unpinned"],
      );
    }

    return NextResponse.json({ ok: Boolean(result.rowCount), pinned });
  } catch (error) {
    console.error("PATCH /api/bot/memory Error:", error);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
