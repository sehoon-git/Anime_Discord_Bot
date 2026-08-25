import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import { getLongTermMemoryLimit, getLongTermMemorySearchLimit } from "@/app/lib/billing";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { createLongTermMemory, listLongTermMemories, type MemoryKind, type MemoryScope } from "@/app/lib/long-term-memory";
import { upsertUser } from "@/app/lib/users";

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const userId = await upsertUser(session.user.email, session.user.name ?? null);
  return { userId, missingConsents: await getMissingRequiredConsents(userId) };
}

function consentUnavailable(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  if (user.missingConsents.length > 0) return NextResponse.json({ ok: false, error: "REQUIRED_CONSENT_MISSING", missingConsents: user.missingConsents }, { status: 403 });
  return null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const response = consentUnavailable(user);
  if (response) return response;
  const [memories, limit, searchLimit] = await Promise.all([
    listLongTermMemories(user.userId),
    getLongTermMemoryLimit(user.userId),
    getLongTermMemorySearchLimit(user.userId),
  ]);
  return NextResponse.json({ ok: true, memories, limit, searchLimit });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const response = consentUnavailable(user);
  if (response) return response;
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content : "";
  const kind: MemoryKind = body?.kind === "preference" || body?.kind === "profile" || body?.kind === "goal" ? body.kind : "fact";
  const scope: MemoryScope = body?.scope === "character" || body?.scope === "guild" ? body.scope : "global";
  const memory = await createLongTermMemory({
    userId: user.userId,
    content,
    kind,
    scope,
    characterId: typeof body?.characterId === "string" ? body.characterId.slice(0, 80) : undefined,
    guildId: typeof body?.guildId === "string" ? body.guildId.slice(0, 80) : undefined,
    importance: typeof body?.importance === "number" ? body.importance : undefined,
  });
  if (!memory) return NextResponse.json({ ok: false, error: "MEMORY_CREATE_FAILED" }, { status: 400 });
  return NextResponse.json({ ok: true, memory }, { status: 201 });
}
