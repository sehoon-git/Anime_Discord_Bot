CREATE TABLE IF NOT EXISTS user_consents (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  privacy_accepted_at TIMESTAMPTZ NOT NULL,
  overseas_accepted_at TIMESTAMPTZ NOT NULL,
  voice_accepted_at TIMESTAMPTZ,
  memory_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
