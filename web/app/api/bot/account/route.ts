import { NextResponse } from "next/server";
import { webPool } from "@/app/lib/db";

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const legacy = request.headers.get("x-bot-api-key");
  const secret = process.env.BOT_SECRET_KEY;

  return Boolean(secret && (bearer === secret || legacy === secret));
}

/**
 * Discord 봇이 웹 계정과 음성 동의 상태를 확인하는 전용 API입니다.
 * 브라우저의 HTML 404 페이지가 아니라 항상 JSON을 반환해야 합니다.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED_BOT" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const discordUserId = searchParams.get("discordUserId");

  if (!discordUserId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_DISCORD_USER_ID" },
      { status: 400 },
    );
  }

  try {
    const result = await webPool.query<{
      user_id: string;
      discord_user_id: string;
      voice_consent: boolean | null;
      voice_consent_updated_at: string | null;
    }>(
      `SELECT
         a.user_id::text AS user_id,
         a.provider_user_id AS discord_user_id,
         c.speech_recognition_allowed AS voice_consent,
         c.updated_at::text AS voice_consent_updated_at
       FROM user_accounts a
       LEFT JOIN voice_consents c ON c.user_id = a.user_id
       WHERE a.provider = 'discord'
         AND a.provider_user_id = $1
       LIMIT 1`,
      [discordUserId],
    );

    const account = result.rows[0];

    if (!account) {
      return NextResponse.json({
        ok: true,
        account: null,
        user: null,
      });
    }

    const voiceConsent = account.voice_consent === true;
    return NextResponse.json({
      ok: true,
      account: {
        userId: account.user_id,
        discordUserId: account.discord_user_id,
        linked: true,
        voiceConsent,
        voiceConsentUpdatedAt: account.voice_consent_updated_at,
      },
      // 이전 봇 클라이언트와의 호환을 위해 함께 제공합니다.
      user: {
        id: account.user_id,
        voice_consent: voiceConsent,
        voiceConsent,
      },
    });
  } catch (error) {
    console.error("GET /api/bot/account Error:", error);
    return NextResponse.json(
      { ok: false, error: "ACCOUNT_LOOKUP_FAILED" },
      { status: 500 },
    );
  }
}
