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

    // 개발 중인 봇 DB는 기능별 테이블 생성 시점이 다를 수 있습니다.
    // 존재하는 테이블의 데이터만 삭제해서, 아직 사용하지 않는 기능의 테이블이
    // 없다는 이유로 전체 회원 탈퇴가 실패하지 않게 합니다.
    const botTables = [
      "memory_audit_events",
      "memory_sources",
      "memory_items",
      "user_memories",
      "conversation_summaries",
      "conversation_turns",
      "performance_events",
    ] as const;
    const existingTables = await botPool.query<{ table_name: string | null }>(
      `SELECT to_regclass('public.' || table_name)::text AS table_name
       FROM unnest($1::text[]) AS table_name`,
      [botTables],
    );
    for (let index = 0; index < botTables.length; index += 1) {
      if (existingTables.rows[index]?.table_name) {
        await botPool.query(`DELETE FROM ${botTables[index]} WHERE user_id = $1`, [userId]);
      }
    }
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
