import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { webPool } from "@/app/lib/db";
import { upsertUser } from "@/app/lib/users";

const allowedLocale = (value: unknown) => value === "ko-KR" ? "ko-KR" : "en-US";
const allowedTone = (value: unknown) => ["friend", "flirty", "romantic"].includes(value as string) ? value : "friend";
const allowedLength = (value: unknown) => ["short", "normal", "long"].includes(value as string) ? value : "normal";
const allowedStyle = (value: unknown) => ["expressive", "fast"].includes(value as string) ? value : "expressive";
const allowedBargeIn = (value: unknown) => value === "stop_command" ? "stop_command" : "immediate";
const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 30) : [];

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const userId = await upsertUser(session.user.email, session.user.name);
  return { userId, email: session.user.email };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const result = await webPool.query(
    `SELECT
       l.locale, l.timezone,
       m.enabled AS memory_enabled, m.retention_days,
       t.sns_tone_enabled, t.relationship_tone, t.response_length,
       t.preferred_topics, t.blocked_topics,
       v.response_enabled AS voice_response_enabled,
       v.summary_enabled AS voice_summary_enabled, v.style AS voice_style,
       v.voice_id, v.speed AS voice_speed, v.volume AS voice_volume,
       v.silent_notification_enabled, v.silent_notification_frequency,
       v.barge_in_mode, v.interruption_count
     FROM language_settings l
     FULL JOIN memory_settings m ON m.user_id = l.user_id
     FULL JOIN text_style_settings t ON t.user_id = COALESCE(l.user_id, m.user_id)
     FULL JOIN voice_behavior v ON v.user_id = COALESCE(l.user_id, m.user_id)
     WHERE COALESCE(l.user_id, m.user_id, t.user_id, v.user_id) = $1`,
    [user.userId],
  );

  return NextResponse.json({ ok: true, preferences: result.rows[0] ?? null });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const locale = allowedLocale(body?.locale);
  const timezone = typeof body?.timezone === "string" && body.timezone.length <= 80 ? body.timezone : "Asia/Seoul";
  const memoryEnabled = body?.memoryEnabled !== false;
  const retentionDays = Number.isInteger(body?.retentionDays) ? Math.min(Math.max(body.retentionDays, 1), 3650) : 30;
  const snsToneEnabled = body?.snsToneEnabled !== false;
  const relationshipTone = allowedTone(body?.relationshipTone);
  const responseLength = allowedLength(body?.responseLength);
  const preferredTopics = list(body?.preferredTopics);
  const blockedTopics = list(body?.blockedTopics);
  const voiceResponseEnabled = body?.voiceResponseEnabled !== false;
  const voiceSummaryEnabled = body?.voiceSummaryEnabled === true;
  const voiceStyle = allowedStyle(body?.voiceStyle);
  const voiceId = typeof body?.voiceId === "string" ? body.voiceId.slice(0, 100) : null;
  const voiceSpeed = typeof body?.voiceSpeed === "number" ? Math.min(Math.max(body.voiceSpeed, 0.5), 2) : 1;
  const voiceVolume = typeof body?.voiceVolume === "number" ? Math.min(Math.max(body.voiceVolume, 0), 1) : 1;
  const silentNotificationEnabled = body?.silentNotificationEnabled !== false;
  const silentNotificationFrequency = Number.isInteger(body?.silentNotificationFrequency) ? Math.min(Math.max(body.silentNotificationFrequency, 0), 20) : 3;
  const bargeInMode = allowedBargeIn(body?.bargeInMode);

  const client = await webPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO language_settings (user_id, locale, timezone) VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET locale=EXCLUDED.locale, timezone=EXCLUDED.timezone, updated_at=NOW()`,
      [user.userId, locale, timezone],
    );
    await client.query(
      `INSERT INTO memory_settings (user_id, enabled, retention_days) VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET enabled=EXCLUDED.enabled, retention_days=EXCLUDED.retention_days, updated_at=NOW()`,
      [user.userId, memoryEnabled, retentionDays],
    );
    await client.query(
      `INSERT INTO text_style_settings (user_id, sns_tone_enabled, relationship_tone, response_length, preferred_topics, blocked_topics)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id) DO UPDATE SET sns_tone_enabled=EXCLUDED.sns_tone_enabled, relationship_tone=EXCLUDED.relationship_tone, response_length=EXCLUDED.response_length, preferred_topics=EXCLUDED.preferred_topics, blocked_topics=EXCLUDED.blocked_topics, updated_at=NOW()`,
      [user.userId, snsToneEnabled, relationshipTone, responseLength, preferredTopics, blockedTopics],
    );
    await client.query(
      `INSERT INTO voice_behavior (user_id, response_enabled, summary_enabled, style, voice_id, speed, volume, silent_notification_enabled, silent_notification_frequency, barge_in_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id) DO UPDATE SET response_enabled=EXCLUDED.response_enabled, summary_enabled=EXCLUDED.summary_enabled, style=EXCLUDED.style, voice_id=EXCLUDED.voice_id, speed=EXCLUDED.speed, volume=EXCLUDED.volume, silent_notification_enabled=EXCLUDED.silent_notification_enabled, silent_notification_frequency=EXCLUDED.silent_notification_frequency, barge_in_mode=EXCLUDED.barge_in_mode, updated_at=NOW()`,
      [user.userId, voiceResponseEnabled, voiceSummaryEnabled, voiceStyle, voiceId, voiceSpeed, voiceVolume, silentNotificationEnabled, silentNotificationFrequency, bargeInMode],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("PATCH /api/settings/preferences Error:", error);
    return NextResponse.json({ ok: false, error: "SETTINGS_SAVE_FAILED" }, { status: 500 });
  } finally {
    client.release();
  }
}
