import { randomInt } from "node:crypto";
import { db } from "@/app/lib/db";

const OCTOMO_URL = "https://api.octoverse.kr/octomo/v1/public/message/exists";
const OCTOMO_NUMBER = "16663538";

let tableReady: Promise<void> | null = null;

async function ensureTable() {
  tableReady ??= db.query(`
    CREATE TABLE IF NOT EXISTS phone_verifications (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      phone_number TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ
    )
  `).then(() => undefined);
  return tableReady;
}

export async function createPhoneVerification(userId: string, phoneNumber: string) {
  await ensureTable();
  const code = String(randomInt(100000, 1000000));
  await db.query(
    `INSERT INTO phone_verifications (user_id, phone_number, code, expires_at, verified_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', NULL)
     ON CONFLICT (user_id) DO UPDATE SET phone_number = EXCLUDED.phone_number, code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, verified_at = NULL`,
    [userId, phoneNumber, code],
  );
  return { code, smsNumber: OCTOMO_NUMBER, smsUrl: `sms:${OCTOMO_NUMBER}?body=${encodeURIComponent(code)}` };
}

export async function verifyPhoneVerification(userId: string) {
  await ensureTable();
  const result = await db.query<{ phone_number: string; code: string; expires_at: Date | string; verified_at: Date | string | null }>(
    `SELECT phone_number, code, expires_at, verified_at FROM phone_verifications WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const pending = result.rows[0];
  if (!pending || pending.verified_at || new Date(pending.expires_at).getTime() < Date.now()) return { verified: false };

  const apiKey = process.env.OCTOMO_API_KEY;
  if (!apiKey) throw new Error("OCTOMO_API_KEY is not configured");

  const response = await fetch(OCTOMO_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Octomo ${apiKey}` },
    body: JSON.stringify({ mobileNum: pending.phone_number, text: pending.code, withinMinutes: 5 }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as { exists?: boolean; verified?: boolean } | null;
  const verified = response.ok && (data?.exists === true || data?.verified === true);
  if (verified) {
    await db.query(`UPDATE phone_verifications SET verified_at = NOW() WHERE user_id = $1`, [userId]);
  }
  return { verified, phoneNumber: pending.phone_number };
}

export async function isVerifiedPhone(userId: string, phoneNumber: string) {
  await ensureTable();
  const result = await db.query<{ verified_at: Date | string | null }>(
    `SELECT verified_at FROM phone_verifications WHERE user_id = $1 AND phone_number = $2 LIMIT 1`,
    [userId, phoneNumber],
  );
  return Boolean(result.rows[0]?.verified_at);
}
