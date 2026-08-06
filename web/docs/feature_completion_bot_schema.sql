-- Run in the Neon database connected by BOT_DATABASE_URL.

CREATE TABLE IF NOT EXISTS voice_join_bot_prompts (
  guild_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL DEFAULT 'seline',
  join_prompt TEXT,
  leave_prompt TEXT,
  consent_prompt TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
