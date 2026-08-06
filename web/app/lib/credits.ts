import { webPool } from "@/app/lib/db";

export async function resolveWebUserIdByDiscordId(discordUserId: string) {
  const result = await webPool.query<{ user_id: string }>(
    `
    SELECT users.id::text AS user_id
    FROM users
    JOIN user_accounts ON user_accounts.user_id = users.id
    WHERE user_accounts.provider = 'discord'
      AND user_accounts.provider_user_id = $1
    LIMIT 1
    `,
    [discordUserId],
  );

  return result.rows[0]?.user_id ?? null;
}

async function ensureCreditBalance(userId: string) {
  await webPool.query(
    `INSERT INTO credit_balances (user_id, balance)
     VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

export async function getCreditBalance(userId: string) {
  await ensureCreditBalance(userId);
  const result = await webPool.query<{ balance: number }>(
    `SELECT balance FROM credit_balances WHERE user_id = $1 LIMIT 1`,
    [userId],
  );

  return result.rows[0]?.balance ?? 0;
}

export async function consumeCredits(userId: string, amount: number) {
  await ensureCreditBalance(userId);

  // The balance check and deduction happen in one UPDATE, so the balance
  // cannot become negative even when two bot requests arrive together.
  const result = await webPool.query<{ balance: number }>(
    `UPDATE credit_balances
     SET balance = balance - $2, updated_at = NOW()
     WHERE user_id = $1 AND balance >= $2
     RETURNING balance`,
    [userId, amount],
  );

  return result.rows[0]?.balance ?? null;
}
