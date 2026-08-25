import { NextResponse } from "next/server";

import { releaseBotQuotaUsage, reserveBotQuotaUsage, type BotQuotaEventType } from "@/app/lib/billing";
import { resolveWebUserIdByDiscordId } from "@/app/lib/credits";

const quotaEventTypes = new Set<BotQuotaEventType>(["text_message", "voice_minute", "image_generation"]);

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const legacy = request.headers.get("x-bot-api-key");
  const secret = process.env.BOT_SECRET_KEY;
  return Boolean(secret && (bearer === secret || legacy === secret));
}

async function userIdForDiscord(discordUserId: string) {
  return discordUserId ? resolveWebUserIdByDiscordId(discordUserId) : null;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const discordUserId = typeof body?.discordUserId === "string" ? body.discordUserId.trim() : "";
  const eventType = typeof body?.eventType === "string" && quotaEventTypes.has(body.eventType as BotQuotaEventType) ? body.eventType as BotQuotaEventType : null;
  const amount = body?.amount;
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  if (!discordUserId || !eventType || !Number.isInteger(amount) || !requestId) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  try {
    const userId = await userIdForDiscord(discordUserId);
    if (!userId) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    const quota = await reserveBotQuotaUsage(userId, eventType, amount, requestId, { discordUserId });
    if (!quota.reserved) return NextResponse.json({ ok: false, error: quota.reason, quota }, { status: 403 });
    return NextResponse.json({ ok: true, userId, quota });
  } catch (error) {
    console.error("POST /api/bot/usage Error:", error);
    return NextResponse.json({ ok: false, error: "QUOTA_RESERVATION_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const discordUserId = typeof body?.discordUserId === "string" ? body.discordUserId.trim() : "";
  const eventType = typeof body?.eventType === "string" && quotaEventTypes.has(body.eventType as BotQuotaEventType) ? body.eventType as BotQuotaEventType : null;
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  if (!discordUserId || !eventType || !requestId) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  try {
    const userId = await userIdForDiscord(discordUserId);
    if (!userId) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    const released = await releaseBotQuotaUsage(userId, eventType, requestId);
    return NextResponse.json({ ok: true, userId, released });
  } catch (error) {
    console.error("DELETE /api/bot/usage Error:", error);
    return NextResponse.json({ ok: false, error: "QUOTA_RELEASE_FAILED" }, { status: 500 });
  }
}
