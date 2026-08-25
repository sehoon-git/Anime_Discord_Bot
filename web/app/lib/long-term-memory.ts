import { botPool, webPool } from "@/app/lib/db";
import { getLongTermMemoryLimit, getLongTermMemorySearchLimit } from "@/app/lib/billing";

export type MemoryKind = "preference" | "profile" | "goal" | "fact";
export type MemoryScope = "global" | "character" | "guild";

export type LongTermMemory = {
  id: string;
  content: string;
  source: string;
  confidence: number;
  isPinned: boolean;
  createdAt: string;
  characterId: string;
  evidenceCount: number;
  kind: MemoryKind;
  scope: MemoryScope;
  importance: number;
  lastUsedAt: string | null;
};

type MemoryRow = {
  id: string;
  content: string;
  source: string;
  confidence: number;
  is_pinned: boolean;
  created_at: Date;
  character_id: string;
  evidence_count: number;
  kind: MemoryKind;
  scope: MemoryScope;
  importance: number;
  last_used_at: Date | null;
};

type Candidate = {
  content: string;
  canonicalKey: string;
  kind: MemoryKind;
  explicit: boolean;
};

let schemaPromise: Promise<void> | null = null;

/**
 * Creates the operational part of the central memory store. The optional
 * pgvector column is supplied by the checked-in migration after the extension
 * has been enabled in Neon; lexical matching remains a safe fallback.
 */
export function ensureLongTermMemorySchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await botPool.query(`
        CREATE TABLE IF NOT EXISTS memory_items (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL,
          character_id TEXT NOT NULL DEFAULT 'seline',
          memory_epoch INTEGER NOT NULL DEFAULT 1,
          scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'character', 'guild')),
          guild_id TEXT,
          kind TEXT NOT NULL CHECK (kind IN ('preference', 'profile', 'goal', 'fact')),
          canonical_key TEXT NOT NULL,
          content TEXT NOT NULL,
          evidence_count INTEGER NOT NULL DEFAULT 1 CHECK (evidence_count >= 1),
          confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1),
          importance NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (importance BETWEEN 0 AND 1),
          is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
          is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
          source TEXT NOT NULL DEFAULT 'conversation',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'deleted')),
          expires_at TIMESTAMPTZ,
          deleted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          ,last_used_at TIMESTAMPTZ
          ,last_used_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS memory_sources (
          id BIGSERIAL PRIMARY KEY,
          memory_id BIGINT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
          user_id BIGINT NOT NULL,
          source_event_id TEXT,
          input_type TEXT NOT NULL CHECK (input_type IN ('text', 'voice')),
          source_text TEXT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_sources_event
          ON memory_sources(user_id, source_event_id)
          WHERE source_event_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_memory_items_scope
          ON memory_items(user_id, character_id, memory_epoch, updated_at DESC)
          WHERE status = 'active' AND deleted_at IS NULL;
      `);

      await botPool.query(`
        ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global';
        ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS guild_id TEXT;
        ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS importance NUMERIC(4, 3) NOT NULL DEFAULT 0.500;
        ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
        ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS last_used_count INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_memory_items_retrieval
          ON memory_items(user_id, scope, character_id, guild_id, updated_at DESC)
          WHERE status = 'active' AND deleted_at IS NULL;
      `);

      const legacyTable = await botPool.query<{ exists: boolean }>(
        `SELECT to_regclass('public.user_memories') IS NOT NULL AS exists`,
      );
      if (legacyTable.rows[0]?.exists) {
        await botPool.query(`
          INSERT INTO memory_items (
            user_id, character_id, memory_epoch, kind, canonical_key, content,
            evidence_count, confidence, is_confirmed, is_pinned, source,
            expires_at, created_at, updated_at
          )
          SELECT
            legacy.user_id, 'seline', 1, 'fact', 'legacy:' || legacy.id::text,
            legacy.content, 2, legacy.confidence, TRUE, legacy.is_pinned,
            'legacy-migration', legacy.expires_at, legacy.created_at, legacy.updated_at
          FROM user_memories legacy
          WHERE legacy.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM memory_items item
              WHERE item.user_id = legacy.user_id
                AND item.canonical_key = 'legacy:' || legacy.id::text
            );
        `);
      }

      // Keep one copy when older versions or repeated requests created the
      // same memory. Pinned and newer memories win automatically.
      await botPool.query(`
        WITH duplicates AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY user_id, LOWER(TRIM(REGEXP_REPLACE(content, '\\s+', ' ', 'g')))
                   ORDER BY is_pinned DESC, updated_at DESC, id DESC
                 ) AS position
          FROM memory_items
          WHERE status = 'active' AND deleted_at IS NULL
        )
        UPDATE memory_items item
        SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
        FROM duplicates
        WHERE item.id = duplicates.id AND duplicates.position > 1
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

function compact(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function keyText(text: string) {
  return compact(text)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .slice(0, 180);
}

function hasSensitiveOrUnsafeContent(text: string) {
  return /(?:password|passcode|api[_ -]?key|secret|token|credit\s*card|\b\d{3}-\d{2}-\d{4}\b|\b\d{6}-?\d{7}\b|\b\d{13,19}\b|\ube44\ubc00\ubc88\ud638|\uc8fc\ubbfc\ub4f1\ub85d\ubc88\ud638|\uc8fc\uc18c|\uc804\ud654\ubc88\ud638|\uc9c8\ubcd1|\uc815\uce58|\uc885\uad50|ignore\s+(?:all\s+)?previous|system\s+prompt)/iu.test(text);
}

function isTemporary(text: string) {
  return /(?:today|tomorrow|yesterday|this\s+week|currently|right\s+now|lately|\uc624\ub298|\ub0b4\uc77c|\uc5b4\uc81c|\ubc29\uae08|\uc694\uc998|\uc774\ubc88\s*\uc8fc|\ud604\uc7ac)/iu.test(text);
}

function explicitMemoryText(text: string) {
  const match = text.match(/^(?:remember(?:\s+this)?|\uae30\uc5b5\ud574\s*(?:\uc918|\uc8fc\uc138\uc694)?|\uae30\uc5b5\ud574)\s*[:,-]?\s*(.+)$/iu);
  return match?.[1] ? compact(match[1]) : null;
}

function makeCandidate(text: string): Candidate | null {
  const explicitContent = explicitMemoryText(text);
  const source = explicitContent ?? compact(text);
  if (source.length < 2 || source.length > 500 || hasSensitiveOrUnsafeContent(source) || isTemporary(source)) {
    return null;
  }

  const preference = source.match(/^(?:i\s+(?:really\s+)?(?:like|love|enjoy)|\ub098\ub294|\uc800\ub294|\ub09c)\s+(.+?)(?:\uc744|\ub97c)?\s*(?:\uc88b\uc544\ud574|\uc88b\uc544\ud569\ub2c8\ub2e4)?$/iu);
  if (preference && /(?:like|love|enjoy|\uc88b\uc544)/iu.test(source)) {
    const value = compact(preference[1]);
    return { content: `Preference: ${value}`, canonicalKey: `preference:${keyText(value)}`, kind: "preference", explicit: Boolean(explicitContent) };
  }

  const name = source.match(/^(?:my\s+name\s+is|i\s+am|\ub0b4\s*\uc774\ub984\uc740|\uc81c\s*\uc774\ub984\uc740)\s+(.+)$/iu);
  if (name) {
    const value = compact(name[1]);
    return { content: `Profile name: ${value}`, canonicalKey: "profile:name", kind: "profile", explicit: Boolean(explicitContent) };
  }

  const goal = source.match(/^(?:my\s+goal\s+is|i\s+want\s+to|\ub0b4\s*\ubaa9\ud45c\ub294|\ubaa9\ud45c\ub294)\s+(.+)$/iu);
  if (goal) {
    const value = compact(goal[1]);
    return { content: `Goal: ${value}`, canonicalKey: `goal:${keyText(value)}`, kind: "goal", explicit: Boolean(explicitContent) };
  }

  if (explicitContent) {
    return { content: source, canonicalKey: `fact:${keyText(source)}`, kind: "fact", explicit: true };
  }

  return null;
}

function candidateImportance(candidate: Candidate) {
  if (candidate.explicit) return 0.9;
  if (candidate.kind === "profile") return 0.85;
  if (candidate.kind === "preference" || candidate.kind === "goal") return 0.75;
  return 0.6;
}

async function memoryAccessEnabled(userId: string) {
  const setting = await webPool.query<{ enabled: boolean }>(
    `SELECT enabled FROM memory_settings WHERE user_id = $1`,
    [userId],
  );
  const consent = await webPool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM user_consents
       WHERE user_id = $1 AND consent_type = 'memory'
     ) AS exists`,
    [userId],
  );
  return (setting.rows[0]?.enabled ?? true) && (consent.rows[0]?.exists ?? false);
}

async function retentionDays(userId: string) {
  const result = await webPool.query<{ retention_days: number }>(
    `SELECT retention_days FROM memory_settings WHERE user_id = $1`,
    [userId],
  );
  return Math.min(Math.max(Number(result.rows[0]?.retention_days ?? 30), 1), 3650);
}

async function makeRoomForNewMemory(userId: string, limit: number) {
  if (limit < 1) return false;

  const countResult = await botPool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM memory_items
     WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId],
  );
  const toRemove = (countResult.rows[0]?.count ?? 0) - limit + 1;
  if (toRemove <= 0) return true;

  const removed = await botPool.query(
    `WITH candidates AS (
       SELECT id
       FROM memory_items
       WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW()) AND is_pinned = FALSE
       ORDER BY updated_at ASC
       LIMIT $2
     )
     UPDATE memory_items
     SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
     WHERE id IN (SELECT id FROM candidates)`,
    [userId, toRemove],
  );
  return (removed.rowCount ?? 0) === toRemove;
}

export async function processLongTermMemory(input: {
  userId: string;
  characterId: string;
  text: string;
  inputType: "text" | "voice";
  sourceEventId?: string | null;
  occurredAt: string;
}) {
  const candidate = makeCandidate(input.text);
  if (!candidate || !(await memoryAccessEnabled(input.userId))) return { stored: false, reason: "NOT_ELIGIBLE" as const };

  await ensureLongTermMemorySchema();
  const duplicate = input.sourceEventId
    ? await botPool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM memory_sources WHERE user_id = $1 AND source_event_id = $2
       ) AS exists`,
      [input.userId, input.sourceEventId],
    )
    : null;
  if (duplicate?.rows[0]?.exists) return { stored: false, reason: "DUPLICATE_EVENT" as const };

  const current = await botPool.query<{ id: string; content: string; evidence_count: number; is_confirmed: boolean }>(
    `SELECT id::text, content, evidence_count, is_confirmed
     FROM memory_items
     WHERE user_id = $1 AND character_id = $2 AND memory_epoch = 1
       AND canonical_key = $3 AND status = 'active' AND deleted_at IS NULL
     ORDER BY updated_at DESC LIMIT 1`,
    [input.userId, input.characterId, candidate.canonicalKey],
  );

  const days = await retentionDays(input.userId);
  let memoryId: string;
  let evidenceCount: number;
  let confirmed: boolean;
  if (current.rows[0]) {
    const previous = current.rows[0];
    evidenceCount = previous.evidence_count + 1;
    confirmed = candidate.explicit || evidenceCount >= 2;
    const result = await botPool.query<{ id: string }>(
      `UPDATE memory_items
       SET content = $4, evidence_count = $5, confidence = $6,
           is_confirmed = $7, importance = $8, updated_at = NOW(), expires_at = NOW() + ($9 * INTERVAL '1 day')
       WHERE id = $1 AND user_id = $2 AND character_id = $3
       RETURNING id::text`,
      [previous.id, input.userId, input.characterId, candidate.content, evidenceCount, confirmed ? 0.9 : 0.6, confirmed, candidateImportance(candidate), days],
    );
    memoryId = result.rows[0].id;
  } else {
    const memoryLimit = await getLongTermMemoryLimit(input.userId);
    if (!(await makeRoomForNewMemory(input.userId, memoryLimit))) {
      return { stored: false, reason: "LIMIT_REACHED" as const };
    }
    evidenceCount = 1;
    confirmed = candidate.explicit;
    const result = await botPool.query<{ id: string }>(
      `INSERT INTO memory_items (
         user_id, character_id, memory_epoch, kind, canonical_key, content,
         evidence_count, confidence, importance, is_confirmed, expires_at
       ) VALUES ($1, $2, 1, $3, $4, $5, 1, $6, $7, $8, NOW() + ($9 * INTERVAL '1 day'))
       RETURNING id::text`,
      [input.userId, input.characterId, candidate.kind, candidate.canonicalKey, candidate.content, candidate.explicit ? 0.95 : 0.5, candidateImportance(candidate), confirmed, days],
    );
    memoryId = result.rows[0].id;
  }

  await botPool.query(
    `INSERT INTO memory_sources (memory_id, user_id, source_event_id, input_type, source_text, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [memoryId, input.userId, input.sourceEventId ?? null, input.inputType, input.text, input.occurredAt],
  );

  return { stored: confirmed, reason: confirmed ? "CONFIRMED" as const : "EVIDENCE_RECORDED" as const, memoryId, evidenceCount };
}

export async function listLongTermMemories(userId: string, characterId?: string) {
  await ensureLongTermMemorySchema();
  const result = await botPool.query<MemoryRow>(
    `SELECT id::text, content, source, confidence, is_pinned, created_at, character_id, evidence_count, kind, scope, importance, last_used_at
     FROM memory_items
     WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW()) AND is_confirmed = TRUE
       AND ($2::text IS NULL OR character_id = $2)
     ORDER BY is_pinned DESC, updated_at DESC`,
    [userId, characterId ?? null],
  );
  return result.rows.map((row) => ({
    id: row.id, content: row.content, source: row.source, confidence: Number(row.confidence),
    isPinned: row.is_pinned, createdAt: row.created_at.toISOString(), characterId: row.character_id,
    evidenceCount: row.evidence_count, kind: row.kind,
    scope: row.scope, importance: Number(row.importance), lastUsedAt: row.last_used_at?.toISOString() ?? null,
  }));
}

function relevanceScore(query: string, content: string) {
  const terms = [...new Set(keyText(query).split(" ").filter((term) => term.length > 1))];
  if (terms.length === 0) return 0;
  const memoryText = keyText(content);
  return terms.filter((term) => memoryText.includes(term)).length / terms.length;
}

function recencyScore(memory: LongTermMemory) {
  const reference = memory.lastUsedAt ?? memory.createdAt;
  const ageDays = Math.max(0, (Date.now() - new Date(reference).getTime()) / 86_400_000);
  return Math.exp(-ageDays / 90);
}

export async function searchLongTermMemories(
  userId: string,
  characterId: string,
  query: string,
  limit = 10,
  guildId?: string | null,
) {
  await ensureLongTermMemorySchema();
  const result = await botPool.query<MemoryRow>(
    `SELECT id::text, content, source, confidence, is_pinned, created_at, character_id,
            evidence_count, kind, scope, importance, last_used_at
     FROM memory_items
     WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
       AND is_confirmed = TRUE
       AND (scope = 'global'
         OR (scope = 'character' AND character_id = $2)
         OR (scope = 'guild' AND guild_id = $3))`,
    [userId, characterId, guildId ?? null],
  );
  const memories = result.rows.map((row) => ({
    id: row.id, content: row.content, source: row.source, confidence: Number(row.confidence),
    isPinned: row.is_pinned, createdAt: row.created_at.toISOString(), characterId: row.character_id,
    evidenceCount: row.evidence_count, kind: row.kind, scope: row.scope,
    importance: Number(row.importance), lastUsedAt: row.last_used_at?.toISOString() ?? null,
  }));
  const planLimit = await getLongTermMemorySearchLimit(userId);
  const selectedLimit = Math.min(Math.max(limit, 1), planLimit);
  const pinned = memories
    .filter((memory) => memory.isPinned)
    .map((memory) => ({ memory, score: 1 + memory.importance * 0.2 + memory.confidence * 0.1 }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(2, selectedLimit));
  const selectedIds = new Set(pinned.map(({ memory }) => memory.id));
  const ranked = memories
    .filter((memory) => !selectedIds.has(memory.id))
    .map((memory) => {
      const relevance = relevanceScore(query, memory.content);
      return { memory, relevance, score: relevance * 0.6 + memory.importance * 0.2 + recencyScore(memory) * 0.1 + memory.confidence * 0.1 };
    })
    .filter(({ relevance }) => relevance >= 0.15)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(0, selectedLimit - pinned.length));
  const selected = [...pinned, ...ranked].map(({ memory }) => memory);
  if (selected.length > 0) {
    await botPool.query(
      `UPDATE memory_items
       SET last_used_at = NOW(), last_used_count = last_used_count + 1
       WHERE user_id = $1 AND id = ANY($2::bigint[])`,
      [userId, selected.map((memory) => memory.id)],
    );
  }
  return selected;
}

export async function searchLongTermMemoriesWithTimeout(
  userId: string,
  characterId: string,
  query: string,
  limit = 10,
  guildId?: string | null,
  timeoutMs = 400,
) {
  return new Promise<LongTermMemory[]>((resolve) => {
    const timer = setTimeout(() => resolve([]), timeoutMs);
    void searchLongTermMemories(userId, characterId, query, limit, guildId)
      .then((memories) => {
        clearTimeout(timer);
        resolve(memories);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve([]);
      });
  });
}

export async function deleteLongTermMemory(userId: string, memoryId: string) {
  await ensureLongTermMemorySchema();
  await botPool.query(
    `UPDATE memory_items SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [memoryId, userId],
  );
}

function cleanManualMemoryContent(value: string) {
  const content = compact(value);
  if (content.length < 2 || content.length > 500 || hasSensitiveOrUnsafeContent(content)) return null;
  return content;
}

function safeScope(value: string | undefined): MemoryScope {
  return value === "character" || value === "guild" ? value : "global";
}

export async function createLongTermMemory(input: {
  userId: string;
  content: string;
  characterId?: string;
  guildId?: string | null;
  scope?: MemoryScope;
  kind?: MemoryKind;
  importance?: number;
}) {
  const content = cleanManualMemoryContent(input.content);
  if (!content) return null;
  await ensureLongTermMemorySchema();
  const existing = await botPool.query<MemoryRow>(
    `SELECT id::text, content, source, confidence, is_pinned, created_at, character_id,
            evidence_count, kind, scope, importance, last_used_at
     FROM memory_items
     WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
       AND LOWER(TRIM(REGEXP_REPLACE(content, '\\s+', ' ', 'g'))) = LOWER($2)
     ORDER BY is_pinned DESC, updated_at DESC, id DESC
     LIMIT 1`,
    [input.userId, content],
  );
  const duplicate = existing.rows[0];
  if (duplicate) return {
    id: duplicate.id, content: duplicate.content, source: duplicate.source, confidence: Number(duplicate.confidence),
    isPinned: duplicate.is_pinned, createdAt: duplicate.created_at.toISOString(), characterId: duplicate.character_id,
    evidenceCount: duplicate.evidence_count, kind: duplicate.kind, scope: duplicate.scope,
    importance: Number(duplicate.importance), lastUsedAt: duplicate.last_used_at?.toISOString() ?? null,
  } satisfies LongTermMemory;
  const memoryLimit = await getLongTermMemoryLimit(input.userId);
  if (!(await makeRoomForNewMemory(input.userId, memoryLimit))) return null;
  const days = await retentionDays(input.userId);
  const scope = safeScope(input.scope);
  const result = await botPool.query<MemoryRow>(
    `INSERT INTO memory_items (
      user_id, character_id, memory_epoch, scope, guild_id, kind, canonical_key,
      content, evidence_count, confidence, importance, is_confirmed, source, expires_at
    ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, 1, 1, $8, TRUE, 'manual', NOW() + ($9 * INTERVAL '1 day'))
    RETURNING id::text, content, source, confidence, is_pinned, created_at, character_id,
              evidence_count, kind, scope, importance, last_used_at`,
    [
      input.userId, input.characterId ?? "seline", scope,
      scope === "guild" ? input.guildId ?? null : null,
      input.kind ?? "fact", `manual:${keyText(content)}`, content,
      Math.min(1, Math.max(0, input.importance ?? 0.75)),
      days,
    ],
  );
  const row = result.rows[0];
  return row ? {
    id: row.id, content: row.content, source: row.source, confidence: Number(row.confidence),
    isPinned: row.is_pinned, createdAt: row.created_at.toISOString(), characterId: row.character_id,
    evidenceCount: row.evidence_count, kind: row.kind, scope: row.scope,
    importance: Number(row.importance), lastUsedAt: row.last_used_at?.toISOString() ?? null,
  } satisfies LongTermMemory : null;
}

export async function updateLongTermMemory(input: {
  userId: string;
  memoryId: string;
  content?: string;
  importance?: number;
}) {
  const content = input.content === undefined ? undefined : cleanManualMemoryContent(input.content);
  if (input.content !== undefined && !content) return null;
  if (input.importance !== undefined && (!Number.isFinite(input.importance) || input.importance < 0 || input.importance > 1)) return null;
  await ensureLongTermMemorySchema();
  const result = await botPool.query<MemoryRow>(
    `UPDATE memory_items
     SET content = COALESCE($3, content),
         canonical_key = CASE WHEN $3::text IS NULL THEN canonical_key ELSE 'manual:' || id::text END,
         importance = COALESCE($4, importance),
         source = 'manual', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'active' AND deleted_at IS NULL
     RETURNING id::text, content, source, confidence, is_pinned, created_at, character_id,
               evidence_count, kind, scope, importance, last_used_at`,
    [input.memoryId, input.userId, content ?? null, input.importance ?? null],
  );
  const row = result.rows[0];
  return row ? {
    id: row.id, content: row.content, source: row.source, confidence: Number(row.confidence),
    isPinned: row.is_pinned, createdAt: row.created_at.toISOString(), characterId: row.character_id,
    evidenceCount: row.evidence_count, kind: row.kind, scope: row.scope,
    importance: Number(row.importance), lastUsedAt: row.last_used_at?.toISOString() ?? null,
  } satisfies LongTermMemory : null;
}

export async function deleteAllLongTermMemories(userId: string) {
  await ensureLongTermMemorySchema();
  await botPool.query(
    `UPDATE memory_items SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
}

export async function setLongTermMemoryPinned(userId: string, memoryId: string, pinned: boolean) {
  await ensureLongTermMemorySchema();
  const result = await botPool.query(
    `UPDATE memory_items SET is_pinned = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'active' AND deleted_at IS NULL`,
    [memoryId, userId, pinned],
  );
  return Boolean(result.rowCount);
}
