import "server-only";

import { db } from "@/app/lib/db";

export type BanSubjectType = "email" | "discord_user_id" | "ip";
export type ActiveBan = {
  id: string;
  reason: string;
  expiresAt: string | null;
};

let moderationSchemaReady: Promise<void> | null = null;

export function normalizeBanSubject(type: BanSubjectType, value: string) {
  const normalized = value.trim();
  return type === "email" ? normalized.toLowerCase() : normalized;
}

export async function ensureModerationSchema() {
  moderationSchemaReady ??= db.query(`
    CREATE TABLE IF NOT EXISTS moderation_bans (
      id BIGSERIAL PRIMARY KEY,
      subject_type TEXT NOT NULL CHECK (subject_type IN ('email', 'discord_user_id', 'ip')),
      subject_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      expires_at TIMESTAMPTZ,
      created_by_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_by_email TEXT,
      revoked_at TIMESTAMPTZ,
      revoke_reason TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS moderation_bans_active_subject_idx
      ON moderation_bans (subject_type, subject_value)
      WHERE revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS moderation_bans_active_lookup_idx
      ON moderation_bans (subject_type, subject_value, expires_at)
      WHERE revoked_at IS NULL;
    CREATE TABLE IF NOT EXISTS moderation_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_value TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `).then(() => undefined);
  return moderationSchemaReady;
}

export async function isBanActive(type: BanSubjectType, value: string) {
  return (await getActiveBan(type, value)) !== null;
}

export async function getActiveBan(type: BanSubjectType, value: string): Promise<ActiveBan | null> {
  await ensureModerationSchema();
  const result = await db.query<{ id: string; reason: string; expires_at: string | null }>(
    `SELECT id, reason, expires_at FROM moderation_bans
      WHERE subject_type = $1 AND subject_value = $2 AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [type, normalizeBanSubject(type, value)],
  );
  const ban = result.rows[0];
  return ban ? { id: ban.id, reason: ban.reason, expiresAt: ban.expires_at } : null;
}

export async function isEmailBanned(email: string) {
  return isBanActive("email", email);
}

export async function getActiveEmailBan(email: string) {
  return getActiveBan("email", email);
}

export async function isDiscordUserBanned(discordUserId: string) {
  return isBanActive("discord_user_id", discordUserId);
}
