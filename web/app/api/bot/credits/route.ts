import { NextResponse } from "next/server";
import {
  consumeCredits,
  getCreditBalance,
  resolveWebUserIdByDiscordId,
} from "@/app/lib/credits";

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

function unauthorized() {
  return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
}

async function getUserId(request: Request) {
  const { searchParams } = new URL(request.url);
  const directUserId = searchParams.get("userId")?.trim();
  const discordUserId = searchParams.get("discordUserId")?.trim();

  if (directUserId) return directUserId;
  if (discordUserId) return resolveWebUserIdByDiscordId(discordUserId);
  return null;
}

export async function GET(request: Request) {
  if (!isAuthorizedBot(request)) return unauthorized();

  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const balance = await getCreditBalance(userId);
    return NextResponse.json({ ok: true, userId, balance, canUse: balance > 0 });
  } catch (error) {
    console.error("GET /api/bot/credits Error:", error);
    return NextResponse.json({ ok: false, error: "CREDIT_READ_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedBot(request)) return unauthorized();

  try {
    const body = await request.json().catch(() => null);
    const discordUserId = typeof body?.discordUserId === "string" ? body.discordUserId.trim() : "";
    const directUserId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const amount = body?.amount;
    const userId = directUserId || (discordUserId ? await resolveWebUserIdByDiscordId(discordUserId) : null);

    if (!userId || !Number.isInteger(amount) || amount <= 0 || amount > 100000) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const balance = await consumeCredits(userId, amount);
    if (balance === null) {
      const currentBalance = await getCreditBalance(userId);
      return NextResponse.json(
        { ok: false, error: "CREDIT_INSUFFICIENT", userId, balance: currentBalance, canUse: false },
        { status: 402 },
      );
    }

    return NextResponse.json({ ok: true, userId, consumed: amount, balance, canUse: balance > 0 });
  } catch (error) {
    console.error("POST /api/bot/credits Error:", error);
    return NextResponse.json({ ok: false, error: "CREDIT_CONSUME_FAILED" }, { status: 500 });
  }
}
