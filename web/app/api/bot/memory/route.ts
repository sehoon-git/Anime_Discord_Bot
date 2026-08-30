import { after, NextResponse } from "next/server";
import { webPool } from "@/app/lib/db";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import {
  listLongTermMemories,
  processLongTermMemory,
  searchLongTermMemoriesWithTimeout,
  setLongTermMemoryPinned,
} from "@/app/lib/long-term-memory";

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

    const characterId = searchParams.get("characterId")?.trim() || "seline";
    const guildId = searchParams.get("guildId")?.trim() || undefined;
    const query = searchParams.get("query")?.trim() || "";
    if (query.length > 2_000) {
      return NextResponse.json({ ok: false, error: "QUERY_TOO_LONG" }, { status: 400 });
    }
    const memories = query
      ? await searchLongTermMemoriesWithTimeout(userId, characterId, query, 10, guildId)
      : await listLongTermMemories(userId, characterId);

    return NextResponse.json({
      ok: true,
      memoryAllowed: true,
      mode: query ? "context" : "list",
      memories: memories.slice(0, 10),
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

  const body = await request.json().catch(() => null);
  const discordUserId = typeof body?.discordUserId === "string" ? body.discordUserId.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const characterId = typeof body?.characterId === "string" ? body.characterId.trim().slice(0, 80) : "seline";
  const inputType = body?.inputType === "voice" ? "voice" : body?.inputType === "text" ? "text" : null;
  const sourceEventId = typeof body?.sourceEventId === "string" ? body.sourceEventId.trim().slice(0, 160) : null;
  const occurredAt = typeof body?.occurredAt === "string" && !Number.isNaN(Date.parse(body.occurredAt))
    ? new Date(body.occurredAt).toISOString()
    : new Date().toISOString();
  if (!discordUserId || !text || !inputType) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const userId = await resolveUserId(discordUserId);
    if (!userId) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    const missingConsents = await getMissingRequiredConsents(userId);
    if (missingConsents.length > 0) {
      return NextResponse.json({ ok: false, error: "REQUIRED_CONSENT_MISSING", missingConsents }, { status: 403 });
    }

    // Memory extraction is deliberately asynchronous: it must never delay a
    // Discord reply. sourceEventId makes repeated delivery idempotent.
    after(async () => {
      try {
        await processLongTermMemory({ userId, characterId, text, inputType, sourceEventId, occurredAt });
      } catch (error) {
        console.error("POST /api/bot/memory extraction Error:", error);
      }
    });
    return NextResponse.json({ ok: true, accepted: true, userId }, { status: 202 });
  } catch (error) {
    console.error("POST /api/bot/memory Error:", error);
    return NextResponse.json({ ok: false, error: "MEMORY_SAVE_REQUEST_FAILED" }, { status: 500 });
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

    const updated = await setLongTermMemoryPinned(userId, memoryId, pinned);
    return NextResponse.json({ ok: updated, pinned });
  } catch (error) {
    console.error("PATCH /api/bot/memory Error:", error);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
