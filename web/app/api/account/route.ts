import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { botPool, webPool } from "@/app/lib/db";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const webClient = await webPool.connect();
  try {
    await webClient.query("BEGIN");
    const userResult = await webClient.query<{ id: string }>("SELECT id::text FROM users WHERE email = $1 FOR UPDATE", [email]);
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      await webClient.query("ROLLBACK");
      return NextResponse.json({ error: "삭제할 계정을 찾을 수 없습니다." }, { status: 404 });
    }

    await botPool.query("DELETE FROM memory_audit_events WHERE user_id = $1", [userId]);
    await botPool.query("DELETE FROM user_memories WHERE user_id = $1", [userId]);
    await botPool.query("DELETE FROM conversation_summaries WHERE user_id = $1", [userId]);
    await botPool.query("DELETE FROM conversation_turns WHERE user_id = $1", [userId]);
    await botPool.query("DELETE FROM performance_events WHERE user_id = $1", [userId]);
    await webClient.query("DELETE FROM users WHERE id = $1", [userId]);
    await webClient.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await webClient.query("ROLLBACK").catch(() => undefined);
    console.error("DELETE /api/account Error:", error);
    return NextResponse.json({ error: "회원 탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  } finally {
    webClient.release();
  }
}
