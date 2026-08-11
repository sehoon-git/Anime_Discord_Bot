import { db } from "@/app/lib/db";
import { upsertUser } from "@/app/lib/users";

const REQUIRED_CONSENTS = ["terms", "privacy", "overseas", "memory", "voice"];

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
    { textMessages: 0, voiceMinutes: 0, creditsUsed: 0 },
  );

  await ensureCreditBalance(userId);
  const [creditResult, modelUsageResult] = await Promise.all([
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
  ]);

  const credit = creditResult.rows[0] ?? { balance: 0 };
  usage.creditsUsed = modelUsageResult.rows[0]?.credits_used ?? 0;

  return {
    userId,
    plan: {
      code: billing.code,
      name: billing.name,
      monthlyPriceKrw: billing.monthly_price_krw,
      monthlyTextMessages: billing.monthly_text_messages,
      monthlyVoiceMinutes: billing.monthly_voice_minutes,
      memoryEnabled: billing.memory_enabled,
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
