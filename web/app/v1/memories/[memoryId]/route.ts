import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { deleteLongTermMemory, updateLongTermMemory } from "@/app/lib/long-term-memory";
import { upsertUser } from "@/app/lib/users";

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const userId = await upsertUser(session.user.email, session.user.name ?? null);
  return { userId, missingConsents: await getMissingRequiredConsents(userId) };
}

export async function PATCH(request: Request, context: { params: Promise<{ memoryId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (user.missingConsents.length > 0) return NextResponse.json({ ok: false, error: "REQUIRED_CONSENT_MISSING" }, { status: 403 });
  const { memoryId } = await context.params;
  const body = await request.json().catch(() => null);
  const memory = await updateLongTermMemory({
    userId: user.userId,
    memoryId,
    content: typeof body?.content === "string" ? body.content : undefined,
    importance: typeof body?.importance === "number" ? body.importance : undefined,
  });
  if (!memory) return NextResponse.json({ ok: false, error: "MEMORY_NOT_FOUND_OR_INVALID" }, { status: 404 });
  return NextResponse.json({ ok: true, memory });
}

export async function DELETE(_request: Request, context: { params: Promise<{ memoryId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (user.missingConsents.length > 0) return NextResponse.json({ ok: false, error: "REQUIRED_CONSENT_MISSING" }, { status: 403 });
  const { memoryId } = await context.params;
  await deleteLongTermMemory(user.userId, memoryId);
  return NextResponse.json({ ok: true });
}
