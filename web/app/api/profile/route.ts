import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import {
  getUserProfileByEmail,
  saveUserProfile,
  upsertUser,
} from "@/app/lib/users";

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_NICKNAME_LENGTH = 30;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
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

  if (displayName.length < 2 || nickname.length < 2) {
    return NextResponse.json(
      { ok: false, error: "이름과 닉네임은 2글자 이상 입력해주세요." },
      { status: 400 },
    );
  }

  const userId = await upsertUser(session.user.email, session.user.name);
  const profile = await saveUserProfile({
    userId,
    displayName,
    nickname,
    source: "web",
  });

  return NextResponse.json({ ok: true, profile });
}
