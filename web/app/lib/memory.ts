import { botPool, webPool } from "@/app/lib/db";
import { ensureUserProfilesTable, updateUserNickname } from "@/app/lib/users";
import {
  deleteAllLongTermMemories,
  deleteLongTermMemory,
  listLongTermMemories,
  setLongTermMemoryPinned,
} from "@/app/lib/long-term-memory";

export type TurnRole = "user" | "assistant";
export type TurnInputType = "text" | "voice";

export type LinkedUser = {
  id: string;
  email: string;
  name: string | null;
  nickname: string | null;
};

export type ConversationTurn = {
  id: string;
  role: TurnRole;
  inputType: TurnInputType;
  content: string;
  createdAt: string;
};

export type UserMemory = {
  id: string;
  content: string;
  source: string;
  confidence: number;
  isPinned: boolean;
  createdAt: string;
};

type TurnRow = {
  id: string;
  role: TurnRole;
  input_type: TurnInputType;
  content: string;
  created_at: Date;
};

export async function findLinkedUserByDiscordId(
  discordUserId: string,
): Promise<LinkedUser | null> {
  await ensureUserProfilesTable();

  const result = await webPool.query<LinkedUser>(
    `
    SELECT
      users.id::text,
      users.email,
      users.name,
      user_profiles.nickname
    FROM users
    JOIN user_accounts ON user_accounts.user_id = users.id
    LEFT JOIN user_profiles ON user_profiles.user_id = users.id
    WHERE user_accounts.provider = 'discord'
      AND user_accounts.provider_user_id = $1
    LIMIT 1
    `,
    [discordUserId],
  );

  return result.rows[0] ?? null;
}

export function extractPreferredNickname(text: string) {
  const patterns = [
    /(?:call\s+me|my\s+name\s+is)\s+([\p{L}\p{N}_ -]{2,30})/iu,
    /(?:\ub0b4\s*\uc774\ub984\uc740|\uc81c\s*\uc774\ub984\uc740|\uc55e\uc73c\ub85c\s*\ub098\ub97c)\s*([\p{L}\p{N}_ -]{2,30})/iu,
  ];

  for (const pattern of patterns) {
    const nickname = pattern.exec(text)?.[1]?.replace(/\s+/g, " ").trim();
    if (nickname) return nickname;
  }

  return null;
}export async function maybeUpdatePreferredNickname(userId: string, text: string) {
  const nickname = extractPreferredNickname(text);

  if (!nickname) {
    return null;
  }

  await updateUserNickname({
    userId,
    nickname,
    source: "discord",
  });

  return nickname;
}

export async function hasConsent(userId: string, consentType: string) {
  const result = await webPool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM user_consents
      WHERE user_id = $1
        AND consent_type = $2
    )
    `,
    [userId, consentType],
  );

  return result.rows[0]?.exists ?? false;
}

export async function cleanupExpiredTurns() {
  await botPool.query("DELETE FROM conversation_turns WHERE expires_at < NOW()");
}

export async function saveTurn(input: {
  userId: string;
  discordUserId: string;
  guildId?: string | null;
  channelId?: string | null;
  role: TurnRole;
  inputType: TurnInputType;
  content: string;
}) {
  await botPool.query(
    `
    INSERT INTO conversation_turns (
      user_id,
      discord_user_id,
      guild_id,
      channel_id,
      role,
      input_type,
      content
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.userId,
      input.discordUserId,
      input.guildId ?? null,
      input.channelId ?? null,
      input.role,
      input.inputType,
      input.content,
    ],
  );
}

export async function getRecentTurns(
  userId: string,
  limit = 48,
  channelId?: string | null,
) {
  const result = await botPool.query<TurnRow>(
    `
    SELECT id::text, role, input_type, content, created_at
    FROM conversation_turns
    WHERE user_id = $1
      AND ($3::text IS NULL OR channel_id = $3)
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [userId, Math.min(Math.max(limit, 1), 48), channelId ?? null],
  );

  return result.rows.reverse().map((row) => ({
    id: row.id,
    role: row.role,
    inputType: row.input_type,
    content: row.content,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getConversationSummary(userId: string) {
  const result = await botPool.query<{ summary: string; turn_count: number }>(
    `
    SELECT summary, turn_count
    FROM conversation_summaries
    WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

function buildSimpleSummary(turns: ConversationTurn[]) {
  const userLines = turns
    .filter((turn) => turn.role === "user")
    .slice(-8)
    .map((turn) => turn.content.trim())
    .filter(Boolean);

  if (userLines.length === 0) {
    return "?袁⑹춦 ?遺용튋?????遺? ?겸뫖???? ??녿뮸??덈뼄.";
  }

  return `筌ㅼ뮄??????癒?뮉 ??쇱벉 雅뚯눘?ｆ에????酉六??щ빍?? ${userLines.join(" / ")}`;
}

export async function refreshSummaryIfNeeded(userId: string) {
  const countResult = await botPool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM conversation_turns
    WHERE user_id = $1
    `,
    [userId],
  );

  const turnCount = Number(countResult.rows[0]?.count ?? 0);
  const current = await getConversationSummary(userId);

  if (turnCount < 20) {
    return current?.summary ?? "";
  }

  const recentTurns = await getRecentTurns(userId, 20);
  const summary = buildSimpleSummary(recentTurns);

  await botPool.query(
    `
    INSERT INTO conversation_summaries (user_id, summary, turn_count, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      summary = EXCLUDED.summary,
      turn_count = EXCLUDED.turn_count,
      updated_at = NOW()
    `,
    [userId, summary, turnCount],
  );

  return summary;
}

export async function listMemories(userId: string) {
  return listLongTermMemories(userId);
}

export async function deleteMemory(userId: string, memoryId: string) {
  await deleteLongTermMemory(userId, memoryId);
}

export async function deleteAllMemories(userId: string) {
  await deleteAllLongTermMemories(userId);
}

export async function setMemoryPinned(userId: string, memoryId: string, pinned: boolean) {
  return setLongTermMemoryPinned(userId, memoryId, pinned);
}
