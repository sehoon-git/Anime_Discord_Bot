import { db } from "@/app/lib/db";

export type UserGender = "female" | "male";

export type UserProfile = {
  userId: string;
  displayName: string | null;
  nickname: string | null;
  gender: UserGender | null;
  birthDate: string | null;
  nicknameUpdatedFrom: string | null;
};

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  nickname: string | null;
  gender: UserGender | null;
  birth_date: Date | string | null;
  nickname_updated_from: string | null;
};

let profileTableReady: Promise<void> | null = null;

function formatBirthDate(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function mapProfile(row: UserProfileRow): UserProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    nickname: row.nickname,
    gender: row.gender,
    birthDate: formatBirthDate(row.birth_date),
    nicknameUpdatedFrom: row.nickname_updated_from,
  };
}

export async function ensureUserProfilesTable() {
  profileTableReady ??= db
    .query(
      `
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
      `,
    )
    .then(() => undefined);

  return profileTableReady;
}

export async function upsertUser(email: string, name?: string | null) {
  const result = await db.query<{ id: string }>(
    `
    INSERT INTO users (email, name, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (email)
    DO UPDATE SET
      name = COALESCE(EXCLUDED.name, users.name),
      updated_at = NOW()
    RETURNING id::text
    `,
    [email, name ?? null],
  );

  return result.rows[0].id;
}

export async function getUserIdByEmail(email: string) {
  const result = await db.query<{ id: string }>(
    "SELECT id::text FROM users WHERE email = $1 LIMIT 1",
    [email],
  );

  return result.rows[0]?.id ?? null;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  await ensureUserProfilesTable();

  const result = await db.query<UserProfileRow>(
    `
    SELECT
      user_id::text,
      display_name,
      nickname,
      gender,
      birth_date,
      nickname_updated_from
    FROM user_profiles
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];
  return row ? mapProfile(row) : null;
}

export async function getUserProfileByEmail(email: string) {
  await ensureUserProfilesTable();

  const result = await db.query<UserProfileRow>(
    `
    SELECT
      users.id::text AS user_id,
      user_profiles.display_name,
      user_profiles.nickname,
      user_profiles.gender,
      user_profiles.birth_date,
      user_profiles.nickname_updated_from
    FROM users
    LEFT JOIN user_profiles ON user_profiles.user_id = users.id
    WHERE users.email = $1
    LIMIT 1
    `,
    [email],
  );

  const row = result.rows[0];
  return row ? mapProfile(row) : null;
}

export function hasCompleteProfile(profile: UserProfile | null) {
  return Boolean(
    profile?.displayName?.trim() &&
      profile?.nickname?.trim() &&
      profile.gender &&
      profile.birthDate,
  );
}

export async function saveUserProfile(input: {
  userId: string;
  displayName: string;
  nickname: string;
  gender: UserGender;
  birthDate: string;
  source?: string;
}) {
  await ensureUserProfilesTable();

  const result = await db.query<UserProfileRow>(
    `
    INSERT INTO user_profiles (
      user_id,
      display_name,
      nickname,
      gender,
      birth_date,
      nickname_updated_from,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5::date, $6, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      nickname = EXCLUDED.nickname,
      gender = EXCLUDED.gender,
      birth_date = EXCLUDED.birth_date,
      nickname_updated_from = EXCLUDED.nickname_updated_from,
      updated_at = NOW()
    RETURNING
      user_id::text,
      display_name,
      nickname,
      gender,
      birth_date,
      nickname_updated_from
    `,
    [
      input.userId,
      input.displayName,
      input.nickname,
      input.gender,
      input.birthDate,
      input.source ?? "web",
    ],
  );

  return mapProfile(result.rows[0]);
}

export async function updateUserNickname(input: {
  userId: string;
  nickname: string;
  source: string;
}) {
  await ensureUserProfilesTable();

  await db.query(
    `
    INSERT INTO user_profiles (
      user_id,
      nickname,
      nickname_updated_from,
      updated_at
    )
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      nickname = EXCLUDED.nickname,
      nickname_updated_from = EXCLUDED.nickname_updated_from,
      updated_at = NOW()
    `,
    [input.userId, input.nickname, input.source],
  );
}
