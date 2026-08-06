-- Run in the Neon database connected by BOT_DATABASE_URL.
-- user_id is the users.id from WEB_DATABASE_URL. There is intentionally no
-- cross-database foreign key because PostgreSQL cannot enforce one here.

CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  auto_voice_join BOOLEAN NOT NULL DEFAULT FALSE,
  manual_voice_join BOOLEAN NOT NULL DEFAULT TRUE,
  default_voice_channel_id TEXT,
  updated_by_discord_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_voice_permissions (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  voice_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_discord_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, channel_id)
);

CREATE TABLE IF NOT EXISTS performance_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  discord_user_id TEXT,
  guild_id TEXT,
  channel_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'stt', 'llm', 'tts', 'voice_capture', 'voice_interruption'
  )),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  success BOOLEAN,
  empty_text BOOLEAN,
  failure_code TEXT,
  vad_score NUMERIC(5, 4) CHECK (vad_score IS NULL OR vad_score BETWEEN 0 AND 1),
  capture_duration_ms INTEGER
    CHECK (capture_duration_ms IS NULL OR capture_duration_ms >= 0),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_events_created
  ON performance_events(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_events_expires
  ON performance_events(expires_at);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_audit_events (
  id BIGSERIAL PRIMARY KEY,
  memory_id BIGINT,
  user_id BIGINT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'pinned', 'unpinned', 'deleted', 'reset')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 3)
  NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1);
ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN
  NOT NULL DEFAULT FALSE;
ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_memories_active
  ON user_memories(user_id, is_pinned DESC, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION cleanup_expired_bot_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM conversation_turns WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM performance_events WHERE expires_at < NOW();
  DELETE FROM user_memories
    WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
