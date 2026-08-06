import { botPool, webPool } from "@/app/lib/db";
import { ensureUserProfilesTable, updateUserNickname } from "@/app/lib/users";

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

type MemoryRow = {
  id: string;
  content: string;
  source: string;
  confidence: number;
  is_pinned: boolean;
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
    /(?:나를|나는|저를|전)\s*([가-힣A-Za-z0-9_ -]{2,30}?)(?:라고|이라|라|으로|로)\s*불러\s*줘/i,
    /(?:앞으로|이제부터)\s*(?:나를|저를)?\s*([가-힣A-Za-z0-9_ -]{2,30}?)(?:라고|이라|라|으로|로)\s*불러\s*줘/i,
    /(?:내\s*닉네임|닉네임)\s*(?:은|을|를|:)?\s*([가-힣A-Za-z0-9_ -]{2,30})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const nickname = match?.[1]?.replace(/\s+/g, " ").trim();

    if (nickname) {
      return nickname;
    }
  }

  return null;
}

export async function maybeUpdatePreferredNickname(userId: string, text: string) {
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

export async function getRecentTurns(userId: string, limit = 20) {
  const result = await botPool.query<TurnRow>(
    `
    SELECT id::text, role, input_type, content, created_at
    FROM conversation_turns
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [userId, limit],
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
    return "아직 요약할 대화가 충분하지 않습니다.";
  }

  return `최근 사용자는 다음 주제로 대화했습니다: ${userLines.join(" / ")}`;
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

function extractMemoryText(text: string) {
  const match = text.match(/(?:기억해줘|기억해|remember)\s*[:：-]?\s*(.+)/i);
  return match?.[1]?.trim() ?? null;
}

export async function maybeStoreMemory(userId: string, text: string) {
  const memoryText = extractMemoryText(text);

  if (!memoryText) {
    return null;
  }

  const memoryAllowed = await hasConsent(userId, "memory");

  if (!memoryAllowed) {
    return null;
  }

  const result = await botPool.query<MemoryRow>(
    `
    INSERT INTO user_memories (user_id, content, source, updated_at)
    VALUES ($1, $2, 'conversation', NOW())
    RETURNING id::text, content, source, confidence, is_pinned, created_at
    `,
    [userId, memoryText],
  );

  const row = result.rows[0];

  await botPool.query(
    `INSERT INTO memory_audit_events (memory_id, user_id, action)
     VALUES ($1, $2, 'created')`,
    [row.id, userId],
  );

  return {
    id: row.id,
    content: row.content,
    source: row.source,
    confidence: Number(row.confidence),
    isPinned: row.is_pinned,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listMemories(userId: string) {
  const result = await botPool.query<MemoryRow>(
    `
    SELECT id::text, content, source, confidence, is_pinned, created_at
    FROM user_memories
    WHERE user_id = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    source: row.source,
    confidence: Number(row.confidence),
    isPinned: row.is_pinned,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function deleteMemory(userId: string, memoryId: string) {
  const result = await botPool.query(
    `
    UPDATE user_memories
    SET deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW()
    WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
    `,
    [userId, memoryId],
  );
  if (result.rowCount) {
    await botPool.query(
      `INSERT INTO memory_audit_events (memory_id, user_id, action)
       VALUES ($1, $2, 'deleted')`,
      [memoryId, userId],
    );
  }
}

export async function deleteAllMemories(userId: string) {
  const result = await botPool.query(
    `UPDATE user_memories SET deleted_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  if (result.rowCount) {
    await botPool.query(
      `INSERT INTO memory_audit_events (user_id, action)
       VALUES ($1, 'reset')`,
      [userId],
    );
  }
}
