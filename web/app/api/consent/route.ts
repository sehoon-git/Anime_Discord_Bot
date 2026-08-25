import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { upsertVoiceConsent } from "@/app/lib/operations";
import { upsertUser } from "@/app/lib/users";

const REQUIRED_CONSENTS = ["terms", "privacy", "overseas", "memory", "voice", "security_ip"];

type DatabaseError = {
  code?: string;
  message?: string;
};

function getConsentDatabaseErrorMessage(error: unknown) {
  const databaseError = error as DatabaseError;
  const code = databaseError.code;
  const message = databaseError.message ?? "";

  if (
    code === "42P01" ||
    message.includes('relation "users" does not exist') ||
    message.includes('relation "user_consents" does not exist')
  ) {
    return "DB 테이블이 아직 없습니다. Neon SQL Editor에서 normalized_schema_migration.sql을 먼저 실행해주세요.";
  }

  if (
    code === "42703" ||
    message.includes('column "user_id" does not exist') ||
    message.includes('column "consent_type" does not exist') ||
    message.includes('column "updated_at" does not exist')
  ) {
    return "DB 동의 테이블이 예전 구조입니다. Neon SQL Editor에서 normalized_schema_migration.sql을 실행해주세요.";
  }

  if (
    code === "28P01" ||
    message.includes("password authentication failed") ||
    message.includes("getaddrinfo") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connection")
  ) {
    return "DATABASE_URL 연결에 실패했습니다. Vercel 환경변수 DATABASE_URL이 현재 Neon 연결 문자열인지 확인해주세요.";
  }

  return "동의 저장 중 서버 오류가 발생했습니다. Vercel Logs에서 /api/consent 오류를 확인해주세요.";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ hasConsent: false }, { status: 401 });
  }

  try {
    const result = await db.query<{ accepted_count: number }>(
      `
      SELECT COUNT(DISTINCT user_consents.consent_type)::int AS accepted_count
      FROM user_consents
      JOIN users ON users.id = user_consents.user_id
      WHERE users.email = $1
        AND user_consents.consent_type = ANY($2::text[])
        AND user_consents.accepted_at IS NOT NULL
      `,
      [session.user.email, REQUIRED_CONSENTS],
    );

    return Response.json({
      hasConsent: result.rows[0].accepted_count === REQUIRED_CONSENTS.length,
    });
  } catch (error) {
    console.error("[consent][GET]", error);

    return Response.json(
      { hasConsent: false, error: getConsentDatabaseErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const terms = body.terms === true;
  const privacy = body.privacy === true;
  const overseas = body.overseas === true;
  const voice = body.voice === true;
  const memory = body.memory === true;
  const securityIp = body.security_ip === true;

  if (!terms || !privacy || !overseas || !memory || !voice || !securityIp) {
    return Response.json(
      { error: "필수 동의 항목이 누락되었습니다." },
      { status: 400 },
    );
  }

  try {
    const now = new Date();
    const userId = await upsertUser(session.user.email, session.user.name);
    const acceptedTypes = REQUIRED_CONSENTS;

    await db.query(
      `
      INSERT INTO user_consents (user_id, consent_type, accepted_at, updated_at)
      SELECT $1, consent_type, $2, NOW()
      FROM UNNEST($3::text[]) AS consent_type
      ON CONFLICT (user_id, consent_type)
      DO UPDATE SET
        accepted_at = EXCLUDED.accepted_at,
        updated_at = NOW()
      `,
      [userId, now, acceptedTypes],
    );

    await upsertVoiceConsent({
      userId,
      speechRecognitionAllowed: true,
      voiceStorageAllowed: false,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[consent][POST]", error);

    return Response.json(
      { error: getConsentDatabaseErrorMessage(error) },
      { status: 500 },
    );
  }
}
