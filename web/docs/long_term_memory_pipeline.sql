-- Central long-term memory migration for BOT_DATABASE_URL (the bot_db database).
-- The application also creates the core tables defensively at runtime. Run this
-- migration once in Neon to add pgvector support for semantic retrieval.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE memory_items
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_memory_items_embedding
  ON memory_items USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50)
  WHERE embedding IS NOT NULL AND status = 'active' AND deleted_at IS NULL;

-- One-time copy of legacy records, if user_memories has old production data.
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

-- Existing legacy memories are copied once by the application using a stable
-- legacy:<id> canonical key. Keep user_memories only until migration checks
-- are complete; it is no longer the operational source of truth.
