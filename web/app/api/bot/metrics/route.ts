import { NextResponse } from "next/server";
import { recordModelUsageEvent, recordPerformanceEvent } from "@/app/lib/operations";

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const legacy = request.headers.get("x-bot-api-key");
  return Boolean(process.env.BOT_SECRET_KEY &&
    (bearer === process.env.BOT_SECRET_KEY || legacy === process.env.BOT_SECRET_KEY));
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.eventType !== "string") {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    await recordPerformanceEvent({
      userId: typeof body.userId === "string" ? body.userId : null,
      discordUserId: typeof body.discordUserId === "string" ? body.discordUserId : null,
      guildId: typeof body.guildId === "string" ? body.guildId : null,
      channelId: typeof body.channelId === "string" ? body.channelId : null,
      eventType: body.eventType,
      durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
      success: typeof body.success === "boolean" ? body.success : null,
      emptyText: typeof body.emptyText === "boolean" ? body.emptyText : null,
      failureCode: typeof body.failureCode === "string" ? body.failureCode : null,
      vadScore: typeof body.vadScore === "number" ? body.vadScore : null,
      captureDurationMs: typeof body.captureDurationMs === "number" ? body.captureDurationMs : null,
    });

    if (body.modelUsage) {
      await recordModelUsageEvent({
        userId: typeof body.userId === "string" ? body.userId : null,
        discordUserId: typeof body.discordUserId === "string" ? body.discordUserId : null,
        provider: body.modelUsage.provider,
        model: body.modelUsage.model,
        inputTokens: body.modelUsage.inputTokens,
        outputTokens: body.modelUsage.outputTokens,
        totalTokens: body.modelUsage.totalTokens,
        creditsUsed: body.modelUsage.creditsUsed,
        requestType: body.modelUsage.requestType,
        success: body.modelUsage.success,
        failureCode: body.modelUsage.failureCode,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/bot/metrics Error:", error);
    return NextResponse.json({ ok: false, error: "METRICS_SAVE_FAILED" }, { status: 500 });
  }
}
