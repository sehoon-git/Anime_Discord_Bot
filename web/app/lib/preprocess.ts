import type { TurnInputType } from "@/app/lib/memory";

const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_CHARACTER_ID = "seline";
const DEFAULT_LOCALE = "en-US";

export type TurnEnvelope = {
  discordUserId: string;
  guildId?: string | null;
  channelId?: string | null;
  messageId?: string | null;
  inputType?: TurnInputType;
  text: string;
  characterId?: string | null;
  locale?: string | null;
  occurredAt?: string | null;
};

export type PreprocessedTurn = {
  discordUserId: string;
  guildId: string | null;
  channelId: string | null;
  messageId: string | null;
  inputType: TurnInputType;
  text: string;
  characterId: string;
  locale: string;
  occurredAt: string;
  memoryCandidate: string | null;
};

type PreprocessResult =
  | { ok: true; turn: PreprocessedTurn }
  | { ok: false; error: "INVALID_BODY" | "MISSING_DISCORD_USER_ID" | "MISSING_TEXT" | "EMPTY_TEXT" };

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeInputType(value: unknown): TurnInputType {
  return value === "voice" ? "voice" : "text";
}

export function normalizeDiscordText(text: string) {
  return text
    .replace(/<@!?\d+>/g, "")
    .replace(/<#\d+>/g, "")
    .replace(/<@&\d+>/g, "")
    .replace(/@everyone|@here/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

export function extractMemoryCandidate(text: string) {
  const match = text.match(/^(?:remember(?:\s+this)?|\uae30\uc5b5\ud574\s*(?:\uc918|\uc8fc\uc138\uc694)?|\uae30\uc5b5\ud574)\s*[:,-]?\s*(.+)$/iu);
  return match?.[1]?.trim() || null;
}

export function preprocessTurnEnvelope(body: unknown): PreprocessResult {
  if (!body || typeof body !== "object") return { ok: false, error: "INVALID_BODY" };

  const input = body as Record<string, unknown>;
  const discordUserId = optionalString(input.discordUserId);
  const rawText = optionalString(input.text);
  if (!discordUserId) return { ok: false, error: "MISSING_DISCORD_USER_ID" };
  if (!rawText) return { ok: false, error: "MISSING_TEXT" };

  const text = normalizeDiscordText(rawText);
  if (!text) return { ok: false, error: "EMPTY_TEXT" };

  const occurredAtInput = optionalString(input.occurredAt);
  const occurredAt = occurredAtInput && !Number.isNaN(Date.parse(occurredAtInput))
    ? new Date(occurredAtInput).toISOString()
    : new Date().toISOString();

  return {
    ok: true,
    turn: {
      discordUserId,
      guildId: optionalString(input.guildId),
      channelId: optionalString(input.channelId),
      messageId: optionalString(input.messageId),
      inputType: normalizeInputType(input.inputType),
      text,
      characterId: optionalString(input.characterId) ?? DEFAULT_CHARACTER_ID,
      locale: optionalString(input.locale) ?? DEFAULT_LOCALE,
      occurredAt,
      memoryCandidate: extractMemoryCandidate(text),
    },
  };
}
