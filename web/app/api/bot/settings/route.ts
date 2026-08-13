import { NextResponse } from "next/server";
import { getMissingRequiredConsents } from "@/app/lib/consent";
import { botPool, webPool } from "@/app/lib/db";

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const legacy = request.headers.get("x-bot-api-key");
  return Boolean(process.env.BOT_SECRET_KEY && (bearer === process.env.BOT_SECRET_KEY || legacy === process.env.BOT_SECRET_KEY));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED_BOT" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guildId");
  const channelId = searchParams.get("channelId");
  const discordUserId = searchParams.get("discordUserId");
  if (!guildId && !discordUserId) return NextResponse.json({ ok: false, error: "MISSING_IDENTIFIER" }, { status: 400 });

  try {
    if (discordUserId) {
      const linked = await webPool.query<{ user_id: string }>(
        `SELECT user_id::text FROM user_accounts WHERE provider = 'discord' AND provider_user_id = $1 LIMIT 1`,
        [discordUserId],
      );
      if (linked.rows[0]) {
        const missingConsents = await getMissingRequiredConsents(linked.rows[0].user_id);
        if (missingConsents.length > 0) {
          return NextResponse.json({ ok: false, error: "REQUIRED_CONSENT_MISSING", missingConsents }, { status: 403 });
        }
      }
    }

    const [guild, channel, user] = await Promise.all([
      guildId ? botPool.query(`SELECT * FROM guild_settings WHERE guild_id = $1`, [guildId]) : Promise.resolve({ rows: [] }),
      guildId && channelId ? botPool.query(`SELECT * FROM channel_voice_permissions WHERE guild_id = $1 AND channel_id = $2`, [guildId, channelId]) : Promise.resolve({ rows: [] }),
      discordUserId ? webPool.query(
        `SELECT l.locale, l.timezone, m.enabled AS memory_enabled, m.retention_days,
                t.sns_tone_enabled, t.relationship_tone, t.response_length,
                t.preferred_topics, t.blocked_topics,
                v.response_enabled AS voice_response_enabled, v.summary_enabled AS voice_summary_enabled,
                v.style AS voice_style, v.voice_id, v.speed AS voice_speed, v.volume AS voice_volume,
                v.silent_notification_enabled, v.silent_notification_frequency, v.barge_in_mode,
                v.interruption_count,
                COALESCE(c.speech_recognition_allowed, uc.accepted_at IS NOT NULL, false) AS voice_consent
         FROM user_accounts a
         JOIN language_settings l ON l.user_id = a.user_id
         LEFT JOIN memory_settings m ON m.user_id = a.user_id
         LEFT JOIN text_style_settings t ON t.user_id = a.user_id
         LEFT JOIN voice_behavior v ON v.user_id = a.user_id
         LEFT JOIN voice_consents c ON c.user_id = a.user_id
         LEFT JOIN user_consents uc
           ON uc.user_id = a.user_id
          AND uc.consent_type = 'voice'
         WHERE a.provider = 'discord' AND a.provider_user_id = $1`, [discordUserId]) : Promise.resolve({ rows: [] }),
    ]);

    return NextResponse.json({ ok: true, guild: guild.rows[0] ?? null, channel: channel.rows[0] ?? null, user: user.rows[0] ?? null });
  } catch (error) {
    console.error("GET /api/bot/settings Error:", error);
    return NextResponse.json({ ok: false, error: "SETTINGS_READ_FAILED" }, { status: 500 });
  }
}
