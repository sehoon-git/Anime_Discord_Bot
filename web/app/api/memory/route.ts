import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import { deleteAllMemories, deleteMemory, listMemories } from "@/app/lib/memory";
import { upsertUser } from "@/app/lib/users";

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return null;
  }

  return upsertUser(email, session.user?.name ?? null);
}

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const memories = await listMemories(userId);

  return NextResponse.json({ ok: true, memories });
}

export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    // 1. 개별 기억 삭제
    if (body.memoryId) {
      await deleteMemory(userId, body.memoryId);
      return NextResponse.json({ ok: true, message: "기억 개별 삭제 완료" });
    }

    // 2. 전체 기억 삭제 (deleteAll이 true이거나 body가 비어있는 경우)
    await deleteAllMemories(userId);
    return NextResponse.json({ ok: true, message: "전체 기억 삭제 완료" });
  } catch (error) {
    console.error("DELETE /api/memory Error:", error);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.memoryId !== "string" || typeof body.pinned !== "boolean") {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const { setMemoryPinned } = await import("@/app/lib/memory");
  const updated = await setMemoryPinned(userId, body.memoryId, body.pinned);
  return NextResponse.json({ ok: updated, pinned: body.pinned });
}
