-- Run this file in BOT_DATABASE_URL, for example the Neon database named bot_db.
-- Web identity tables such as users, user_accounts, and user_consents live in WEB_DATABASE_URL.
-- This database stores the web users.id value as user_id without a foreign key.

CREATE TABLE IF NOT EXISTS conversation_turns (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  discord_user_id TEXT NOT NULL,
  guild_id TEXT,
  channel_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'voice')),
  content TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_turns_user_created
  ON conversation_turns(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_turns_expires
  ON conversation_turns(expires_at);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  user_id BIGINT PRIMARY KEY,
  summary TEXT NOT NULL,
  turn_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_memories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_created
  ON user_memories(user_id, created_at DESC);

ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 3)
  NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1);

ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN
  NOT NULL DEFAULT FALSE;

ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_memories_active
  ON user_memories(user_id, is_pinned DESC, updated_at DESC)
  WHERE deleted_at IS NULL;
