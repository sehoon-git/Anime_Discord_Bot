import { db } from "@/app/lib/db";

export const REQUIRED_CONSENT_TYPES = [
  "terms",
  "privacy",
  "overseas",
  "memory",
] as const;

export async function getMissingRequiredConsents(userId: string) {
  const result = await db.query<{ consent_type: string }>(
    `
    SELECT consent_type
    FROM user_consents
    WHERE user_id = $1
      AND consent_type = ANY($2::text[])
      AND accepted_at IS NOT NULL
    `,
    [userId, REQUIRED_CONSENT_TYPES],
  );

  const accepted = new Set(result.rows.map((row) => row.consent_type));
  return REQUIRED_CONSENT_TYPES.filter((type) => !accepted.has(type));
}

export async function hasRequiredConsents(userId: string) {
  return (await getMissingRequiredConsents(userId)).length === 0;
}
