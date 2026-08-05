import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { createPhoneVerification, verifyPhoneVerification } from "@/app/lib/phoneVerification";
import { upsertUser } from "@/app/lib/users";

export const runtime = "nodejs";

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return /^010\d{8}$/.test(digits) ? digits : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const userId = await upsertUser(session.user.email, session.user.name);
  const body = await request.json().catch(() => null);

  try {
    if (body?.action === "start") {
      const phoneNumber = normalizePhone(body.phoneNumber);
      if (!phoneNumber) return NextResponse.json({ ok: false, error: "한국 휴대폰 번호 010으로 입력해주세요." }, { status: 400 });
      const verification = await createPhoneVerification(userId, phoneNumber);
      return NextResponse.json({ ok: true, ...verification });
    }

    if (body?.action === "check") {
      const result = await verifyPhoneVerification(userId);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: false, error: "잘못된 인증 요청입니다." }, { status: 400 });
  } catch (error) {
    console.error("[phone-verification]", error);
    return NextResponse.json({ ok: false, error: "휴대폰 인증 서비스를 잠시 사용할 수 없습니다." }, { status: 503 });
  }
}
