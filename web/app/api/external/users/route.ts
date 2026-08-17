import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { REQUIRED_CONSENT_TYPES } from "@/app/lib/consent";
import { db } from "@/app/lib/db";
import { ensureUserProfilesTable } from "@/app/lib/users";

export const runtime = "nodejs";

type UserRow = {
  user_id: string;
  nickname: string | null;
  gender: "female" | "male" | null;
  birth_date: Date | string | null;
  locale: "en-US" | "ko-KR" | "ja-JP";
};

function isValidApiKey(request: Request) {
  const expected = process.env.SHARED_DEVELOPER_API_KEY;
  const provided = request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || !provided) return false;

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

function formatBirthDate(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export async function GET(request: Request) {
  if (!isValidApiKey(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await ensureUserProfilesTable();
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId")?.trim() || null;
    const parsedLimit = Number(url.searchParams.get("limit") ?? "100");
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 100;

    if (userId && !/^\d+$/.test(userId)) {
      return NextResponse.json({ ok: false, error: "INVALID_USER_ID" }, { status: 400 });
    }

    const result = await db.query<UserRow>(
      `
      SELECT
        user_id::text,
        nickname,
        gender,
        birth_date,
        locale
      FROM user_profiles
      WHERE ($1::bigint IS NULL OR user_id = $1::bigint)
        AND (
          SELECT COUNT(DISTINCT c.consent_type)
          FROM user_consents c
          WHERE c.user_id = user_profiles.user_id
            AND c.consent_type = ANY($3::text[])
            AND c.accepted_at IS NOT NULL
        ) = $4
      ORDER BY updated_at DESC
      LIMIT $2
      `,
      [userId, limit, REQUIRED_CONSENT_TYPES, REQUIRED_CONSENT_TYPES.length],
    );

    const users = result.rows.map((row) => ({
      userId: row.user_id,
      nickname: row.nickname,
      gender: row.gender,
      birthDate: formatBirthDate(row.birth_date),
      locale: row.locale ?? "en-US",
    }));

    return NextResponse.json({ ok: true, count: users.length, users });
  } catch (error) {
    console.error("GET /api/external/users Error:", error);
    return NextResponse.json({ ok: false, error: "USER_LOOKUP_FAILED" }, { status: 500 });
  }
}
