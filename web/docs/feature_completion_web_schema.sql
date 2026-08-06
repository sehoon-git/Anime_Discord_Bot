-- Run in the Neon database connected by WEB_DATABASE_URL.
-- These tables keep the external bot contract explicit while the existing
-- user_preferences table remains available for backwards compatibility.

CREATE TABLE IF NOT EXISTS language_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'en-US' CHECK (locale IN ('en-US', 'ko-KR')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 3650),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS text_style_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sns_tone_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  relationship_tone TEXT NOT NULL DEFAULT 'friend'
    CHECK (relationship_tone IN ('friend', 'flirty', 'romantic')),
  response_length TEXT NOT NULL DEFAULT 'normal'
    CHECK (response_length IN ('short', 'normal', 'long')),
  preferred_topics TEXT[] NOT NULL DEFAULT '{}',
  blocked_topics TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_behavior (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  response_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  summary_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  style TEXT NOT NULL DEFAULT 'expressive' CHECK (style IN ('expressive', 'fast')),
  voice_id TEXT,
  speed NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (speed BETWEEN 0.50 AND 2.00),
  volume NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (volume BETWEEN 0.00 AND 1.00),
  silent_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  silent_notification_frequency INTEGER NOT NULL DEFAULT 3 CHECK (silent_notification_frequency BETWEEN 0 AND 20),
  barge_in_mode TEXT NOT NULL DEFAULT 'immediate' CHECK (barge_in_mode IN ('immediate', 'stop_command')),
  interruption_count INTEGER NOT NULL DEFAULT 0 CHECK (interruption_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_balances (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  discord_user_id TEXT,
  provider TEXT NOT NULL DEFAULT 'gemini',
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  request_type TEXT NOT NULL DEFAULT 'text',
  success BOOLEAN NOT NULL DEFAULT TRUE,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_usage_events_user_created
  ON model_usage_events(user_id, created_at DESC);

INSERT INTO language_settings (user_id, locale, timezone)
SELECT id, COALESCE(locale, 'en-US'), COALESCE(timezone, 'Asia/Seoul')
FROM user_profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO memory_settings (user_id, enabled)
SELECT id, TRUE FROM users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO text_style_settings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO voice_behavior (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO credit_balances (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
