import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import {
  getUserProfileByEmail,
  saveUserProfile,
  type UserGender,
  upsertUser,
} from "@/app/lib/users";

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_NICKNAME_LENGTH = 30;
const REQUIRED_CONSENTS = ["terms", "privacy", "overseas", "memory"];
const OPTIONAL_CONSENTS = ["voice"];

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanGender(value: unknown): UserGender | null {
  return value === "female" || value === "male" ? value : null;
}

function cleanBirthDate(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  if (date > new Date()) return null;

  return value;
}

async function saveConsents(userId: string, voice: boolean) {
  const now = new Date();
  const acceptedTypes = [
    ...REQUIRED_CONSENTS,
    ...(voice ? ["voice"] : []),
  ];

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

  await db.query(
    `
    DELETE FROM user_consents
    WHERE user_id = $1
      AND consent_type = ANY($2::text[])
      AND NOT (consent_type = ANY($3::text[]))
    `,
    [userId, OPTIONAL_CONSENTS, acceptedTypes],
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = await upsertUser(session.user.email, session.user.name);
  const profile = await getUserProfileByEmail(session.user.email);

  return NextResponse.json({
    ok: true,
    profile: profile ?? {
      userId,
      displayName: session.user.name ?? "",
      nickname: "",
      gender: null,
      birthDate: null,
      nicknameUpdatedFrom: null,
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const displayName = cleanText(body?.displayName, MAX_DISPLAY_NAME_LENGTH);
  const nickname = cleanText(body?.nickname, MAX_NICKNAME_LENGTH);
  const gender = cleanGender(body?.gender);
  const birthDate = cleanBirthDate(body?.birthDate);
  const voice = body?.voice === true;

  const terms = body?.terms === true;
  const privacy = body?.privacy === true;
  const overseas = body?.overseas === true;
  const memory = body?.memory === true;

  if (displayName.length < 2 || nickname.length < 2) {
    return NextResponse.json(
      { ok: false, error: "이름과 닉네임은 2글자 이상 입력해주세요." },
      { status: 400 },
    );
  }

  if (!gender) {
    return NextResponse.json(
      { ok: false, error: "성별을 선택해주세요." },
      { status: 400 },
    );
  }

  if (!birthDate) {
    return NextResponse.json(
      { ok: false, error: "생년월일을 올바르게 입력해주세요." },
      { status: 400 },
    );
  }

  if (!terms || !privacy || !overseas || !memory) {
    return NextResponse.json(
      { ok: false, error: "필수 약관에 모두 동의해주세요." },
      { status: 400 },
    );
  }

  const userId = await upsertUser(session.user.email, session.user.name);
  const profile = await saveUserProfile({
    userId,
    displayName,
    nickname,
    gender,
    birthDate,
    source: "web",
  });

  await saveConsents(userId, voice);

  return NextResponse.json({ ok: true, profile });
}
