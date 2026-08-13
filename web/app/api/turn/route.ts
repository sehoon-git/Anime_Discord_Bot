import { NextResponse } from "next/server";

import { getMissingRequiredConsents } from "@/app/lib/consent";

import {
  cleanupExpiredTurns,
  findLinkedUserByDiscordId,
  getRecentTurns,
  hasConsent,
  maybeUpdatePreferredNickname,
  refreshSummaryIfNeeded,
  saveTurn,
  type TurnInputType,
} from "@/app/lib/memory";
import { processLongTermMemory, searchLongTermMemories } from "@/app/lib/long-term-memory";
import { getAssistantPreferences } from "@/app/lib/operations";

function isInputType(value: unknown): value is TurnInputType {
  return value === "text" || value === "voice";
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const discordUserId = optionalString(body.discordUserId);
    const text = optionalString(body.text);
    const assistantText = optionalString(body.assistantText);
    const inputType = isInputType(body.inputType) ? body.inputType : "text";
    const characterId = optionalString(body.characterId) ?? "seline";

    if (!discordUserId || !text) {
      return NextResponse.json(
        { ok: false, error: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    await cleanupExpiredTurns();

    const linkedUser = await findLinkedUserByDiscordId(discordUserId);

    if (!linkedUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "DISCORD_ACCOUNT_NOT_LINKED",
          messageForBot:
            "먼저 웹사이트에서 Google 로그인 후 Discord 계정을 연동해주세요.",
        },
        { status: 403 },
      );
    }

    const missingConsents = await getMissingRequiredConsents(linkedUser.id);
    if (missingConsents.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "REQUIRED_CONSENT_MISSING",
          missingConsents,
          messageForBot: "Required service consents are incomplete.",
        },
        { status: 403 },
      );
    }

    await saveTurn({
      userId: linkedUser.id,
      discordUserId,
      guildId: optionalString(body.guildId),
      channelId: optionalString(body.channelId),
      role: "user",
      inputType,
      content: text,
    });

    const updatedNickname = await maybeUpdatePreferredNickname(linkedUser.id, text);

    if (updatedNickname) {
      linkedUser.nickname = updatedNickname;
    }

    if (assistantText) {
      await saveTurn({
        userId: linkedUser.id,
        discordUserId,
        guildId: optionalString(body.guildId),
        channelId: optionalString(body.channelId),
        role: "assistant",
        inputType: "text",
        content: assistantText,
      });
    }

    const summary = await refreshSummaryIfNeeded(linkedUser.id);
    const recentTurns = await getRecentTurns(linkedUser.id, 48);
    const preferences = await getAssistantPreferences(linkedUser.id);
    const memoryAllowed =
      (preferences?.memory_enabled ?? true) && await hasConsent(linkedUser.id, "memory");
    const memories = memoryAllowed
      ? await searchLongTermMemories(linkedUser.id, characterId, text, 10)
      : [];
    const memory = await processLongTermMemory({
      userId: linkedUser.id,
      characterId,
      text,
      inputType,
      sourceEventId: optionalString(body.messageId),
      occurredAt: optionalString(body.occurredAt) ?? new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      user: linkedUser,
      recentTurns,
      summary,
      memories,
      memory,
    });
  } catch (error) {
    console.error("[turn-api]", error);

    return NextResponse.json(
      { ok: false, error: "TURN_API_ERROR" },
      { status: 500 },
    );
  }
}
