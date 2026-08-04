import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ hasConsent: false }, { status: 401 });
  }

  const result = await db.query(
    "SELECT id FROM user_consents WHERE email = $1 LIMIT 1",
    [session.user.email],
  );

  return Response.json({ hasConsent: (result.rowCount ?? 0) > 0 });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const terms = body.terms === true;
  const privacy = body.privacy === true;
  const overseas = body.overseas === true;
  const voice = body.voice === true;
  const memory = body.memory === true;

  if (!terms || !privacy || !overseas) {
    return Response.json(
      { error: "Required consents are missing" },
      { status: 400 },
    );
  }

  const now = new Date();

  await db.query(
    `
    INSERT INTO user_consents (
      email,
      name,
      terms_accepted_at,
      privacy_accepted_at,
      overseas_accepted_at,
      voice_accepted_at,
      memory_accepted_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (email)
    DO UPDATE SET
      name = EXCLUDED.name,
      terms_accepted_at = EXCLUDED.terms_accepted_at,
      privacy_accepted_at = EXCLUDED.privacy_accepted_at,
      overseas_accepted_at = EXCLUDED.overseas_accepted_at,
      voice_accepted_at = EXCLUDED.voice_accepted_at,
      memory_accepted_at = EXCLUDED.memory_accepted_at,
      updated_at = NOW()
    `,
    [
      session.user.email,
      session.user.name ?? null,
      now,
      now,
      now,
      voice ? now : null,
      memory ? now : null,
    ],
  );

  return Response.json({ ok: true });
}
