import { NextResponse } from "next/server";
import { botPool } from "@/app/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await botPool.query<{ cleanup_expired_bot_data: number }>(
      "SELECT cleanup_expired_bot_data()",
    );
    return NextResponse.json({ ok: true, deletedTurns: result.rows[0]?.cleanup_expired_bot_data ?? 0 });
  } catch (error) {
    console.error("GET /api/cron/cleanup Error:", error);
    return NextResponse.json({ ok: false, error: "CLEANUP_FAILED" }, { status: 500 });
  }
}
