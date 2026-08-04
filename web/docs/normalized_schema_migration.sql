CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (email, name, created_at, updated_at)
SELECT email, name, created_at, updated_at
FROM user_consents
ON CONFLICT (email)
DO UPDATE SET
  name = COALESCE(EXCLUDED.name, users.name),
  updated_at = NOW();

INSERT INTO users (email, name, created_at, updated_at)
SELECT email, google_name, created_at, updated_at
FROM user_accounts
ON CONFLICT (email)
DO UPDATE SET
  name = COALESCE(EXCLUDED.name, users.name),
  updated_at = NOW();

ALTER TABLE user_consents RENAME TO user_consents_old;
ALTER TABLE user_accounts RENAME TO user_accounts_old;

CREATE TABLE user_consents (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, consent_type)
);

INSERT INTO user_consents (user_id, consent_type, accepted_at, created_at, updated_at)
SELECT users.id, consent_type, accepted_at, old.created_at, old.updated_at
FROM user_consents_old old
JOIN users ON users.email = old.email
CROSS JOIN LATERAL (
  VALUES
    ('terms', old.terms_accepted_at),
    ('privacy', old.privacy_accepted_at),
    ('overseas', old.overseas_accepted_at),
    ('voice', old.voice_accepted_at),
    ('memory', old.memory_accepted_at)
) AS consent_values(consent_type, accepted_at)
WHERE accepted_at IS NOT NULL
ON CONFLICT (user_id, consent_type)
DO UPDATE SET
  accepted_at = EXCLUDED.accepted_at,
  updated_at = NOW();

CREATE TABLE user_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  username TEXT,
  global_name TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider),
  UNIQUE (provider, provider_user_id)
);

INSERT INTO user_accounts (
  user_id,
  provider,
  provider_user_id,
  username,
  global_name,
  avatar,
  created_at,
  updated_at
)
SELECT
  users.id,
  'discord',
  old.discord_user_id,
  old.discord_username,
  old.discord_global_name,
  old.discord_avatar,
  old.created_at,
  old.updated_at
FROM user_accounts_old old
JOIN users ON users.email = old.email
WHERE old.discord_user_id IS NOT NULL
ON CONFLICT (user_id, provider)
DO UPDATE SET
  provider_user_id = EXCLUDED.provider_user_id,
  username = EXCLUDED.username,
  global_name = EXCLUDED.global_name,
  avatar = EXCLUDED.avatar,
  updated_at = NOW();
