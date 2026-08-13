import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM user_accounts WHERE email = $1", [email]);
    await client.query("DELETE FROM user_consents WHERE email = $1", [email]);
    await client.query("COMMIT");
    return Response.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/account Error:", error);
    return Response.json(
      { error: "회원 탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
