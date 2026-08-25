import { NextResponse } from "next/server";

import { getBillingStatusForUser, recordImageGenerationUsage } from "@/app/lib/billing";
import { webPool } from "@/app/lib/db";

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const legacy = request.headers.get("x-bot-api-key");
  const secret = process.env.BOT_SECRET_KEY;
  return Boolean(secret && (bearer === secret || legacy === secret));
}

async function linkedUser(discordUserId: string) {
  const result = await webPool.query<{ id: string; email: string; name: string | null }>(
    `SELECT users.id::text, users.email, users.name
     FROM users
     JOIN user_accounts ON user_accounts.user_id = users.id
     WHERE user_accounts.provider = 'discord' AND user_accounts.provider_user_id = $1
     LIMIT 1`,
    [discordUserId],
  );
  return result.rows[0] ?? null;
}

function imageAccess(billing: Awaited<ReturnType<typeof getBillingStatusForUser>>) {
  const used = billing.usage.imageGenerations;
  const limit = billing.plan.monthlyImageGenerations;
  return {
    enabled: billing.plan.imageGenerationEnabled,
    monthlyLimit: limit,
    used,
    remaining: Math.max(0, limit - used),
    canGenerate: billing.subscription.status === "active" && billing.plan.imageGenerationEnabled && used < limit,
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
  const discordUserId = new URL(request.url).searchParams.get("discordUserId")?.trim();
  if (!discordUserId) return NextResponse.json({ ok: false, error: "MISSING_DISCORD_USER_ID" }, { status: 400 });
  try {
    const user = await linkedUser(discordUserId);
    if (!user) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    const billing = await getBillingStatusForUser(user.email, user.name);
    return NextResponse.json({
      ok: true,
      userId: user.id,
      plan: billing.plan,
      subscription: billing.subscription,
      usage: billing.usage,
      imageGeneration: imageAccess(billing),
    });
  } catch (error) {
    console.error("GET /api/bot/billing Error:", error);
    return NextResponse.json({ ok: false, error: "BILLING_READ_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const discordUserId = typeof body?.discordUserId === "string" ? body.discordUserId.trim() : "";
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  if (!discordUserId || !requestId) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  try {
    const user = await linkedUser(discordUserId);
    if (!user) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    const usage = await recordImageGenerationUsage(user.id, requestId, { discordUserId });
    if (!usage.recorded) return NextResponse.json({ ok: false, error: usage.reason, imageGeneration: usage }, { status: 403 });
    return NextResponse.json({ ok: true, userId: user.id, imageGeneration: usage });
  } catch (error) {
    console.error("POST /api/bot/billing Error:", error);
    return NextResponse.json({ ok: false, error: "IMAGE_USAGE_RECORD_FAILED" }, { status: 500 });
  }
}
