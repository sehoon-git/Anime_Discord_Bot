import { botPool, webPool } from "@/app/lib/db";

export type AssistantPreferences = {
  locale: "en-US" | "ko-KR";
  timezone: string;
  memory_enabled: boolean;
  relationship_tone: "friend" | "flirty" | "romantic";
  response_length: "short" | "normal" | "long";
  sns_tone_enabled: boolean;
  voice_response_enabled: boolean;
  voice_summary_enabled: boolean;
  voice_style: "expressive" | "fast";
  voice_speed: number;
  voice_volume: number;
  barge_in_mode: "immediate" | "stop_command";
};

export async function getAssistantPreferences(userId: string): Promise<AssistantPreferences | null> {
  const result = await webPool.query<AssistantPreferences>(
    `SELECT l.locale, l.timezone, m.enabled AS memory_enabled,
            t.relationship_tone, t.response_length, t.sns_tone_enabled,
            v.response_enabled AS voice_response_enabled,
            v.summary_enabled AS voice_summary_enabled, v.style AS voice_style,
            v.speed AS voice_speed, v.volume AS voice_volume, v.barge_in_mode
     FROM language_settings l
     LEFT JOIN memory_settings m ON m.user_id = l.user_id
     LEFT JOIN text_style_settings t ON t.user_id = l.user_id
     LEFT JOIN voice_behavior v ON v.user_id = l.user_id
     WHERE l.user_id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function recordPerformanceEvent(input: {
  userId?: string | null;
  discordUserId?: string | null;
  guildId?: string | null;
  channelId?: string | null;
  eventType: "stt" | "llm" | "tts" | "voice_capture" | "voice_interruption";
  durationMs?: number | null;
  success?: boolean | null;
  emptyText?: boolean | null;
  failureCode?: string | null;
  vadScore?: number | null;
  captureDurationMs?: number | null;
}) {
  await botPool.query(
    `INSERT INTO performance_events
      (user_id, discord_user_id, guild_id, channel_id, event_type,
       duration_ms, success, empty_text, failure_code, vad_score,
       capture_duration_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.userId ?? null,
      input.discordUserId ?? null,
      input.guildId ?? null,
      input.channelId ?? null,
      input.eventType,
      input.durationMs ?? null,
      input.success ?? null,
      input.emptyText ?? null,
      input.failureCode ?? null,
      input.vadScore ?? null,
      input.captureDurationMs ?? null,
    ],
  );
}

export async function incrementVoiceInterruption(userId: string) {
  await webPool.query(
    `INSERT INTO voice_behavior (user_id, interruption_count)
     VALUES ($1, 1)
     ON CONFLICT (user_id) DO UPDATE SET
       interruption_count = voice_behavior.interruption_count + 1,
       updated_at = NOW()`,
    [userId],
  );
}

export async function recordModelUsageEvent(input: {
  userId?: string | null;
  discordUserId?: string | null;
  provider?: string;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  creditsUsed?: number;
  requestType?: string;
  success?: boolean;
  failureCode?: string | null;
}) {
  await webPool.query(
    `INSERT INTO model_usage_events
      (user_id, discord_user_id, provider, model, input_tokens,
       output_tokens, total_tokens, credits_used, request_type,
       success, failure_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.userId ?? null,
      input.discordUserId ?? null,
      input.provider ?? "gemini",
      input.model ?? null,
      Math.max(0, input.inputTokens ?? 0),
      Math.max(0, input.outputTokens ?? 0),
      Math.max(0, input.totalTokens ?? 0),
      Math.max(0, input.creditsUsed ?? 0),
      input.requestType ?? "text",
      input.success ?? true,
      input.failureCode ?? null,
    ],
  );
}

export async function upsertVoiceConsent(input: {
  userId: string;
  speechRecognitionAllowed: boolean;
  voiceStorageAllowed?: boolean;
  consentVersion?: string;
}) {
  await webPool.query(
    `INSERT INTO voice_consents
      (user_id, speech_recognition_allowed, voice_storage_allowed,
       consent_version, accepted_at, revoked_at, updated_at)
     VALUES ($1,$2,$3,$4,CASE WHEN $2 THEN NOW() ELSE NULL END,
       CASE WHEN $2 THEN NULL ELSE NOW() END,NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       speech_recognition_allowed = EXCLUDED.speech_recognition_allowed,
       voice_storage_allowed = EXCLUDED.voice_storage_allowed,
       consent_version = EXCLUDED.consent_version,
       accepted_at = EXCLUDED.accepted_at,
       revoked_at = EXCLUDED.revoked_at,
       updated_at = NOW()`,
    [
      input.userId,
      input.speechRecognitionAllowed,
      input.voiceStorageAllowed ?? false,
      input.consentVersion ?? "1",
    ],
  );
}

export async function canProcessVoice(userId: string) {
  const result = await webPool.query<{ allowed: boolean }>(
    `SELECT speech_recognition_allowed AS allowed
     FROM voice_consents WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0]?.allowed ?? false;
}
