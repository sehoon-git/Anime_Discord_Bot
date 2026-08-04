CREATE TABLE IF NOT EXISTS conversation_turns (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  turn_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_memories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_created
  ON user_memories(user_id, created_at DESC);
