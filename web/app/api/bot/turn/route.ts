import { NextResponse } from "next/server";

import {
  cleanupExpiredTurns,
  findLinkedUserByDiscordId,
  getConversationSummary,
  getRecentTurns,
  hasConsent,
  listMemories,
  maybeStoreMemory,
  maybeUpdatePreferredNickname,
  refreshSummaryIfNeeded,
  saveTurn,
} from "@/app/lib/memory";
import {
  buildFallbackReply,
  buildModelMessages,
  buildPersonaPrompt,
} from "@/app/lib/persona";
import { preprocessTurnEnvelope } from "@/app/lib/preprocess";
import { getUserProfile } from "@/app/lib/users";

export const runtime = "nodejs";

const REQUIRED_CONSENTS = ["terms", "privacy", "overseas", "memory"] as const;

function getBotSecretFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-bot-api-key") ?? request.headers.get("x-bot-secret");
}

function isAuthorizedBot(request: Request) {
  const expected = process.env.BOT_SECRET_KEY;
  return Boolean(expected && getBotSecretFromRequest(request) === expected);
}

async function getConsentStatus(userId: string) {
  const entries = await Promise.all(
    REQUIRED_CONSENTS.map(
      async (type) => [type, await hasConsent(userId, type)] as const,
    ),
  );

  const missing = entries.filter(([, accepted]) => !accepted).map(([type]) => type);

  return { ok: missing.length === 0, missing };
}

export async function POST(request: Request) {
  if (!isAuthorizedBot(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED_BOT" },
      { status: 401 },
    );
  }

  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = preprocessTurnEnvelope(rawBody);

    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const turn = parsed.turn;

    await cleanupExpiredTurns();

    const linkedUser = await findLinkedUserByDiscordId(turn.discordUserId);

    if (!linkedUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "DISCORD_ACCOUNT_NOT_LINKED",
          messageForBot:
            "웹사이트에서 Google 로그인 후 Discord 계정을 먼저 연동해주세요.",
        },
        { status: 403 },
      );
    }

    const consentStatus = await getConsentStatus(linkedUser.id);

    if (!consentStatus.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "REQUIRED_CONSENT_MISSING",
          missingConsents: consentStatus.missing,
          messageForBot: "웹사이트에서 필수 이용 동의를 먼저 완료해주세요.",
        },
        { status: 403 },
      );
    }

    const userProfile = await getUserProfile(linkedUser.id);
    const responseLocale = userProfile?.locale ?? turn.locale;

    const updatedNickname = await maybeUpdatePreferredNickname(
      linkedUser.id,
      turn.text,
    );

    if (updatedNickname) {
      linkedUser.nickname = updatedNickname;
    }

    const memoryAllowed = await hasConsent(linkedUser.id, "memory");
    const [recentTurns, summary, memories] = await Promise.all([
      getRecentTurns(linkedUser.id),
      getConversationSummary(linkedUser.id),
      memoryAllowed ? listMemories(linkedUser.id) : Promise.resolve([]),
    ]);

    const modelMessages = buildModelMessages({
      characterId: turn.characterId,
      locale: responseLocale,
      summary: summary?.summary ?? null,
      memories,
      recentTurns,
      userText: turn.text,
      userNickname: linkedUser.nickname,
    });

    await saveTurn({
      userId: linkedUser.id,
      discordUserId: turn.discordUserId,
      guildId: turn.guildId,
      channelId: turn.channelId,
      role: "user",
      inputType: turn.inputType,
      content: turn.text,
    });

    const savedMemory = await maybeStoreMemory(linkedUser.id, turn.text);
    const reply = buildFallbackReply(turn.text, Boolean(savedMemory));

    await saveTurn({
      userId: linkedUser.id,
      discordUserId: turn.discordUserId,
      guildId: turn.guildId,
      channelId: turn.channelId,
      role: "assistant",
      inputType: "text",
      content: reply,
    });

    const refreshedSummary = await refreshSummaryIfNeeded(linkedUser.id);
    const recentAfter = await getRecentTurns(linkedUser.id);

    return NextResponse.json({
      ok: true,
      reply,
      user: linkedUser,
      turn: { ...turn, locale: responseLocale },
      context: {
        memoryAllowed,
        summary: refreshedSummary || summary?.summary || null,
        recentTurns: recentAfter,
        memories,
      },
      modelInput: {
        personaPrompt: buildPersonaPrompt({
          characterId: turn.characterId,
          locale: responseLocale,
          summary: summary?.summary ?? null,
          memories,
          recentTurns,
          userNickname: linkedUser.nickname,
        }),
        messages: modelMessages,
      },
      savedMemory,
    });
  } catch (error) {
    console.error("POST /api/bot/turn Error:", error);

    return NextResponse.json(
      { ok: false, error: "BOT_TURN_FAILED" },
      { status: 500 },
    );
  }
}
