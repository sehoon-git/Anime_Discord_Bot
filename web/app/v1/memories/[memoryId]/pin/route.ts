import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { setLongTermMemoryPinned } from "@/app/lib/long-term-memory";
import { upsertUser } from "@/app/lib/users";

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const userId = await upsertUser(session.user.email, session.user.name ?? null);
  return { userId, missingConsents: await getMissingRequiredConsents(userId) };
}

async function setPinned(context: { params: Promise<{ memoryId: string }> }, pinned: boolean) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (user.missingConsents.length > 0) return NextResponse.json({ ok: false, error: "REQUIRED_CONSENT_MISSING" }, { status: 403 });
  const { memoryId } = await context.params;
  const updated = await setLongTermMemoryPinned(user.userId, memoryId, pinned);
  return NextResponse.json({ ok: updated, pinned }, { status: updated ? 200 : 404 });
}

export async function POST(request: Request, context: { params: Promise<{ memoryId: string }> }) {
  void request;
  return setPinned(context, true);
}

export async function DELETE(request: Request, context: { params: Promise<{ memoryId: string }> }) {
  void request;
  return setPinned(context, false);
}
