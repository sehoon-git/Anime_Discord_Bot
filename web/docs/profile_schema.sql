CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  nickname TEXT,
  gender TEXT CHECK (gender IN ('female', 'male')),
  birth_date DATE,
  nickname_updated_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('female', 'male'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname
  ON user_profiles (nickname);
