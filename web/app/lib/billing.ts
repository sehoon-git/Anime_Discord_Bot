import { db } from "@/app/lib/db";
import { upsertUser } from "@/app/lib/users";

const REQUIRED_CONSENTS = ["terms", "privacy", "overseas", "memory", "voice", "security_ip"];

export type UsageEventType = "text_message" | "voice_minute";

export type BillingStatus = {
  userId: string;
  plan: {
    code: string;
    name: string;
    monthlyPriceKrw: number;
    monthlyTextMessages: number;
    monthlyVoiceMinutes: number;
    memoryEnabled: boolean;
    longTermMemoryLimit: number;
    imageGenerationEnabled: boolean;
    monthlyImageGenerations: number;
  };
  subscription: {
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  usage: {
    textMessages: number;
    voiceMinutes: number;
    creditsUsed: number;
    imageGenerations: number;
  };
  credits: {
    balance: number;
  };
};

type BillingRow = {
  code: string;
  name: string;
  monthly_price_krw: number;
  monthly_text_messages: number;
  monthly_voice_minutes: number;
  memory_enabled: boolean;
  long_term_memory_limit: number;
  image_generation_enabled: boolean;
  monthly_image_generations: number;
  status: string;
  current_period_start: Date | string | null;
  current_period_end: Date | string | null;
};

type UsageRow = {
  event_type: UsageEventType;
  used: number;
};

type DiscordAccountRow = {
  id: string;
  email: string;
  name: string | null;
};

type CreditRow = { balance: number };

function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function ensureBillingPlanCatalog() {
  await db.query(`
    ALTER TABLE plans
      ADD COLUMN IF NOT EXISTS long_term_memory_limit INTEGER NOT NULL DEFAULT 5
      CHECK (long_term_memory_limit >= 0),
      ADD COLUMN IF NOT EXISTS image_generation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS monthly_image_generations INTEGER NOT NULL DEFAULT 0
      CHECK (monthly_image_generations >= 0);
    INSERT INTO plans (
      code, name, monthly_price_krw, monthly_text_messages,
      monthly_voice_minutes, memory_enabled, long_term_memory_limit,
      image_generation_enabled, monthly_image_generations
    ) VALUES
      ('free', 'Free', 0, 100, 10, TRUE, 5, FALSE, 0),
      ('like', 'Like♥', 5900, 500, 30, TRUE, 20, FALSE, 0),
      ('more-like', 'More♥Like', 15900, 3000, 300, TRUE, 100, FALSE, 0),
      ('love', 'Love♥', 35900, 10000, 1000, TRUE, 500, TRUE, 50)
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      monthly_price_krw = EXCLUDED.monthly_price_krw,
      monthly_text_messages = EXCLUDED.monthly_text_messages,
      monthly_voice_minutes = EXCLUDED.monthly_voice_minutes,
      memory_enabled = EXCLUDED.memory_enabled,
      long_term_memory_limit = EXCLUDED.long_term_memory_limit,
      image_generation_enabled = EXCLUDED.image_generation_enabled,
      monthly_image_generations = EXCLUDED.monthly_image_generations,
      updated_at = NOW();
    UPDATE subscriptions
    SET plan_id = (SELECT id FROM plans WHERE code = 'more-like'), updated_at = NOW()
    WHERE plan_id = (SELECT id FROM plans WHERE code = 'pro');

    CREATE TABLE IF NOT EXISTS image_generation_usage (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      request_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_image_generation_usage_request
      ON image_generation_usage(user_id, request_id)
      WHERE request_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_image_generation_usage_month
      ON image_generation_usage(user_id, created_at DESC);
  `);
}

async function ensureFreeSubscription(userId: string) {
  await db.query(
    `
    INSERT INTO subscriptions (user_id, plan_id, status, updated_at)
    SELECT $1, plans.id, 'active', NOW()
    FROM plans
    WHERE plans.code = 'free'
    ON CONFLICT (user_id)
    DO NOTHING
    `,
    [userId],
  );
}

async function ensureCreditBalance(userId: string) {
  await db.query(
    `INSERT INTO credit_balances (user_id, balance)
     VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

export async function getBillingStatusForUser(
  email: string,
  name?: string | null,
): Promise<BillingStatus> {
  const userId = await upsertUser(email, name);
  await ensureBillingPlanCatalog();
  await ensureFreeSubscription(userId);

  const billingResult = await db.query<BillingRow>(
    `
    SELECT
      plans.code,
      plans.name,
      plans.monthly_price_krw,
      plans.monthly_text_messages,
      plans.monthly_voice_minutes,
      plans.memory_enabled,
      plans.long_term_memory_limit,
      plans.image_generation_enabled,
      plans.monthly_image_generations,
      subscriptions.status,
      subscriptions.current_period_start,
      subscriptions.current_period_end
    FROM subscriptions
    JOIN plans ON plans.id = subscriptions.plan_id
    WHERE subscriptions.user_id = $1
    LIMIT 1
    `,
    [userId],
  );

  const billing = billingResult.rows[0];

  if (!billing) {
    throw new Error("Billing plan is not configured");
  }

  const usageResult = await db.query<UsageRow>(
    `
    SELECT event_type, COALESCE(SUM(amount), 0)::int AS used
    FROM usage_events
    WHERE user_id = $1
      AND created_at >= date_trunc('month', NOW())
    GROUP BY event_type
    `,
    [userId],
  );

  const usage = usageResult.rows.reduce(
    (acc, row) => {
      if (row.event_type === "text_message") {
        acc.textMessages = row.used;
      }

      if (row.event_type === "voice_minute") {
        acc.voiceMinutes = row.used;
      }

      return acc;
    },
    { textMessages: 0, voiceMinutes: 0, creditsUsed: 0, imageGenerations: 0 },
  );

  await ensureCreditBalance(userId);
  const [creditResult, modelUsageResult, imageUsageResult] = await Promise.all([
    db.query<CreditRow>(
      `SELECT balance FROM credit_balances WHERE user_id = $1 LIMIT 1`,
      [userId],
    ),
    db.query<{ credits_used: number }>(
      `SELECT COALESCE(SUM(credits_used), 0)::int AS credits_used
       FROM model_usage_events
       WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
      [userId],
    ),
    db.query<{ used: number }>(
      `SELECT COUNT(*)::int AS used
       FROM image_generation_usage
       WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
      [userId],
    ),
  ]);

  const credit = creditResult.rows[0] ?? { balance: 0 };
  usage.creditsUsed = modelUsageResult.rows[0]?.credits_used ?? 0;
  usage.imageGenerations = imageUsageResult.rows[0]?.used ?? 0;

  return {
    userId,
    plan: {
      code: billing.code,
      name: billing.name,
      monthlyPriceKrw: billing.monthly_price_krw,
      monthlyTextMessages: billing.monthly_text_messages,
      monthlyVoiceMinutes: billing.monthly_voice_minutes,
      memoryEnabled: billing.memory_enabled,
      longTermMemoryLimit: billing.long_term_memory_limit,
      imageGenerationEnabled: billing.image_generation_enabled,
      monthlyImageGenerations: billing.monthly_image_generations,
    },
    subscription: {
      status: billing.status,
      currentPeriodStart: toIsoString(billing.current_period_start),
      currentPeriodEnd: toIsoString(billing.current_period_end),
    },
    usage,
    credits: { balance: credit.balance },
  };
}

export async function getLongTermMemoryLimit(userId: string) {
  await ensureBillingPlanCatalog();
  const result = await db.query<{ long_term_memory_limit: number }>(
    `SELECT plans.long_term_memory_limit
     FROM subscriptions
     JOIN plans ON plans.id = subscriptions.plan_id
     WHERE subscriptions.user_id = $1 AND subscriptions.status = 'active'
     LIMIT 1`,
    [userId],
  );
  return Math.max(0, Number(result.rows[0]?.long_term_memory_limit ?? 5));
}

export async function recordImageGenerationUsage(userId: string, requestId: string, metadata: Record<string, unknown> = {}) {
  if (!requestId || requestId.length > 160) throw new Error("Invalid image request ID");
  await ensureBillingPlanCatalog();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: string }>(
      `SELECT id::text FROM image_generation_usage WHERE user_id = $1 AND request_id = $2 LIMIT 1`,
      [userId, requestId],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return { recorded: true, alreadyRecorded: true, used: 0, limit: 0, remaining: 0 };
    }

    const plan = await client.query<{ enabled: boolean; limit: number }>(
      `SELECT plans.image_generation_enabled AS enabled, plans.monthly_image_generations AS limit
       FROM subscriptions
       JOIN plans ON plans.id = subscriptions.plan_id
       WHERE subscriptions.user_id = $1 AND subscriptions.status = 'active'
       FOR UPDATE OF subscriptions`,
      [userId],
    );
    const planRow = plan.rows[0];
    if (!planRow?.enabled || Number(planRow.limit) < 1) {
      await client.query("ROLLBACK");
      return { recorded: false, alreadyRecorded: false, used: 0, limit: Number(planRow?.limit ?? 0), remaining: 0, reason: "PLAN_NOT_ELIGIBLE" as const };
    }
    const usage = await client.query<{ used: number }>(
      `SELECT COUNT(*)::int AS used FROM image_generation_usage
       WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
      [userId],
    );
    const used = usage.rows[0]?.used ?? 0;
    const limit = Number(planRow.limit);
    if (used >= limit) {
      await client.query("ROLLBACK");
      return { recorded: false, alreadyRecorded: false, used, limit, remaining: 0, reason: "IMAGE_QUOTA_EXCEEDED" as const };
    }
    await client.query(
      `INSERT INTO image_generation_usage (user_id, request_id, metadata) VALUES ($1, $2, $3::jsonb)`,
      [userId, requestId, JSON.stringify(metadata)],
    );
    await client.query("COMMIT");
    return { recorded: true, alreadyRecorded: false, used: used + 1, limit, remaining: limit - used - 1 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getLongTermMemorySearchLimit(userId: string) {
  await ensureBillingPlanCatalog();
  const result = await db.query<{ code: string }>(
    `SELECT plans.code
     FROM subscriptions
     JOIN plans ON plans.id = subscriptions.plan_id
     WHERE subscriptions.user_id = $1 AND subscriptions.status = 'active'
     LIMIT 1`,
    [userId],
  );
  const planCode = result.rows[0]?.code ?? "free";
  return planCode === "love" ? 10 : planCode === "more-like" ? 8 : planCode === "like" ? 5 : 3;
}

export async function addTestCredits(userId: string, amount = 100) {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) {
    throw new Error("Invalid test credit amount");
  }

  await ensureCreditBalance(userId);
  const result = await db.query<{ balance: number }>(
    `UPDATE credit_balances
     SET balance = balance + $2, updated_at = NOW()
     WHERE user_id = $1
     RETURNING balance`,
    [userId, amount],
  );
  return result.rows[0]?.balance ?? 0;
}

export async function recordUsageEvent(
  userId: string,
  eventType: UsageEventType,
  amount = 1,
  metadata: Record<string, unknown> = {},
) {
  await db.query(
    `
    INSERT INTO usage_events (user_id, event_type, amount, metadata)
    VALUES ($1, $2, $3, $4::jsonb)
    `,
    [userId, eventType, amount, JSON.stringify(metadata)],
  );
}

export async function getBotAccessByDiscordUserId(discordUserId: string) {
  const accountResult = await db.query<DiscordAccountRow>(
    `
    SELECT users.id, users.email, users.name
    FROM user_accounts
    JOIN users ON users.id = user_accounts.user_id
    WHERE user_accounts.provider = 'discord'
      AND user_accounts.provider_user_id = $1
    LIMIT 1
    `,
    [discordUserId],
  );

  const account = accountResult.rows[0];

  if (!account) {
    return {
      allowed: false,
      reason: "discord_not_linked" as const,
    };
  }

  const consentResult = await db.query<{ accepted_count: number }>(
    `
    SELECT COUNT(DISTINCT consent_type)::int AS accepted_count
    FROM user_consents
    WHERE user_id = $1
      AND consent_type = ANY($2::text[])
    `,
    [account.id, REQUIRED_CONSENTS],
  );

  const acceptedCount = consentResult.rows[0]?.accepted_count ?? 0;

  if (acceptedCount !== REQUIRED_CONSENTS.length) {
    return {
      allowed: false,
      reason: "required_consent_missing" as const,
      userId: account.id,
      email: account.email,
    };
  }

  const billing = await getBillingStatusForUser(account.email, account.name);

  return {
    allowed: true,
    userId: account.id,
    email: account.email,
    planCode: billing.plan.code,
    billing,
  };
}
