import { db } from "@/app/lib/db";

export async function upsertUser(email: string, name?: string | null) {
  const result = await db.query<{ id: string }>(
    `
    INSERT INTO users (email, name, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (email)
    DO UPDATE SET
      name = COALESCE(EXCLUDED.name, users.name),
      updated_at = NOW()
    RETURNING id
    `,
    [email, name ?? null],
  );

  return result.rows[0].id;
}
