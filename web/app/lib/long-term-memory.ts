import { botPool, webPool } from "@/app/lib/db";
import { getLongTermMemoryLimit } from "@/app/lib/billing";

export type MemoryKind = "preference" | "profile" | "goal" | "fact";

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
          kind TEXT NOT NULL CHECK (kind IN ('preference', 'profile', 'goal', 'fact')),
          canonical_key TEXT NOT NULL,
          content TEXT NOT NULL,
          evidence_count INTEGER NOT NULL DEFAULT 1 CHECK (evidence_count >= 1),
          confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (confidence BETWEEN 0 AND 1),
          is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
          is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
          source TEXT NOT NULL DEFAULT 'conversation',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'deleted')),
          expires_at TIMESTAMPTZ,
          deleted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

      const legacyTable = await botPool.query<{ exists: boolean }>(
        `SELECT to_regclass('public.user_memories') IS NOT NULL AS exists`,
      );
      if (!legacyTable.rows[0]?.exists) return;

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
     WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL AND expires_at > NOW()`,
    [userId],
  );
  const toRemove = (countResult.rows[0]?.count ?? 0) - limit + 1;
  if (toRemove <= 0) return true;

  const removed = await botPool.query(
    `WITH candidates AS (
       SELECT id
       FROM memory_items
       WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
         AND expires_at > NOW() AND is_pinned = FALSE
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
           is_confirmed = $7, updated_at = NOW(), expires_at = NOW() + ($8 * INTERVAL '1 day')
       WHERE id = $1 AND user_id = $2 AND character_id = $3
       RETURNING id::text`,
      [previous.id, input.userId, input.characterId, candidate.content, evidenceCount, confirmed ? 0.9 : 0.6, confirmed, days],
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
         evidence_count, confidence, is_confirmed, expires_at
       ) VALUES ($1, $2, 1, $3, $4, $5, 1, $6, $7, NOW() + ($8 * INTERVAL '1 day'))
       RETURNING id::text`,
      [input.userId, input.characterId, candidate.kind, candidate.canonicalKey, candidate.content, candidate.explicit ? 0.95 : 0.5, confirmed, days],
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
    `SELECT id::text, content, source, confidence, is_pinned, created_at, character_id, evidence_count, kind
     FROM memory_items
     WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
       AND expires_at > NOW() AND is_confirmed = TRUE
       AND ($2::text IS NULL OR character_id = $2)
     ORDER BY is_pinned DESC, updated_at DESC`,
    [userId, characterId ?? null],
  );
  return result.rows.map((row) => ({
    id: row.id, content: row.content, source: row.source, confidence: Number(row.confidence),
    isPinned: row.is_pinned, createdAt: row.created_at.toISOString(), characterId: row.character_id,
    evidenceCount: row.evidence_count, kind: row.kind,
  }));
}

export async function searchLongTermMemories(userId: string, characterId: string, query: string, limit = 10) {
  const memories = await listLongTermMemories(userId, characterId);
  const terms = keyText(query).split(" ").filter((term) => term.length > 1);
  return memories
    .map((memory) => ({ memory, score: memory.evidenceCount + terms.reduce((score, term) => score + (keyText(memory.content).includes(term) ? 2 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(limit, 1), 10))
    .map(({ memory }) => memory);
}

export async function deleteLongTermMemory(userId: string, memoryId: string) {
  await ensureLongTermMemorySchema();
  await botPool.query(
    `UPDATE memory_items SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [memoryId, userId],
  );
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
