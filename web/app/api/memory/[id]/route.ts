import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import { deleteMemory } from "@/app/lib/memory";
import { upsertUser } from "@/app/lib/users";

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return null;
  }

  return upsertUser(email, session.user?.name ?? null);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  await deleteMemory(userId, id);

  return NextResponse.json({ ok: true });
}
