CREATE TABLE IF NOT EXISTS plans (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  monthly_price_krw INTEGER NOT NULL DEFAULT 0,
  monthly_text_messages INTEGER NOT NULL DEFAULT 0,
  monthly_voice_minutes INTEGER NOT NULL DEFAULT 0,
  memory_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  long_term_memory_limit INTEGER NOT NULL DEFAULT 5 CHECK (long_term_memory_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (
  code,
  name,
  monthly_price_krw,
  monthly_text_messages,
  monthly_voice_minutes,
  memory_enabled,
  long_term_memory_limit
)
VALUES
  ('free', 'Free', 0, 100, 10, TRUE, 5),
  ('like', 'Like♥', 5900, 500, 60, TRUE, 20),
  ('more-like', 'More♥Like', 15900, 3000, 180, TRUE, 100),
  ('love', 'Love♥', 35900, 10000, 500, TRUE, 500)
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_krw = EXCLUDED.monthly_price_krw,
  monthly_text_messages = EXCLUDED.monthly_text_messages,
  monthly_voice_minutes = EXCLUDED.monthly_voice_minutes,
  memory_enabled = EXCLUDED.memory_enabled,
  long_term_memory_limit = EXCLUDED.long_term_memory_limit,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

INSERT INTO subscriptions (user_id, plan_id, status, updated_at)
SELECT users.id, plans.id, 'active', NOW()
FROM users
CROSS JOIN plans
WHERE plans.code = 'free'
ON CONFLICT (user_id)
DO NOTHING;
