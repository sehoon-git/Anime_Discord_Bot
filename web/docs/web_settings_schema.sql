-- Run in the Neon database connected by WEB_DATABASE_URL.
-- This database stores account-wide user settings and consent records.

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sns_tone_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  voice_response_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  voice_summary_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  voice_style TEXT NOT NULL DEFAULT 'expressive'
    CHECK (voice_style IN ('expressive', 'fast')),
  voice_speed NUMERIC(3, 2) NOT NULL DEFAULT 1.00
    CHECK (voice_speed BETWEEN 0.50 AND 2.00),
  voice_volume NUMERIC(3, 2) NOT NULL DEFAULT 1.00
    CHECK (voice_volume BETWEEN 0.00 AND 1.00),
  silent_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  silent_notification_frequency INTEGER NOT NULL DEFAULT 3
    CHECK (silent_notification_frequency BETWEEN 0 AND 20),
  barge_in_mode TEXT NOT NULL DEFAULT 'immediate'
    CHECK (barge_in_mode IN ('immediate', 'stop_command')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  relationship_tone TEXT NOT NULL DEFAULT 'friend'
    CHECK (relationship_tone IN ('friend', 'flirty', 'romantic')),
  response_length TEXT NOT NULL DEFAULT 'normal'
    CHECK (response_length IN ('short', 'normal', 'long')),
  preferred_topics TEXT[] NOT NULL DEFAULT '{}',
  blocked_topics TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_consents (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  speech_recognition_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  voice_storage_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version TEXT NOT NULL DEFAULT '1',
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_consents_allowed
  ON voice_consents(user_id, speech_recognition_allowed);

-- Existing profiles may already have locale in some deployments.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Seoul';

-- Keep updated_at correct when a preference row is changed.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_preferences_set_updated_at ON user_preferences;
CREATE TRIGGER user_preferences_set_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS voice_consents_set_updated_at ON voice_consents;
CREATE TRIGGER voice_consents_set_updated_at
  BEFORE UPDATE ON voice_consents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
