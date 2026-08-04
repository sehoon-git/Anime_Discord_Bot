import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { getDiscordBotInviteUrl } from "@/app/lib/discord";

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_ME_URL = "https://discord.com/api/users/@me";

type DiscordTokenResponse = {
  access_token?: string;
  token_type?: string;
  error?: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.redirect(
      new URL("/api/auth/signin/google?callbackUrl=/dashboard", getBaseUrl()),
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("discord_oauth_state")?.value;

  cookieStore.delete("discord_oauth_state");

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/dashboard?discord=state_error", getBaseUrl()));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const baseUrl = getBaseUrl();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Discord OAuth environment variables are missing" },
      { status: 500 },
    );
  }

  const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${baseUrl}/api/discord/callback`,
    }),
  });

  const token = (await tokenResponse.json()) as DiscordTokenResponse;

  if (!tokenResponse.ok || !token.access_token) {
    console.error("Discord token exchange failed", token);
    return NextResponse.redirect(new URL("/dashboard?discord=token_error", baseUrl));
  }

  const userResponse = await fetch(DISCORD_ME_URL, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  const discordUser = (await userResponse.json()) as DiscordUser;

  if (!userResponse.ok || !discordUser.id) {
    console.error("Discord user fetch failed", discordUser);
    return NextResponse.redirect(new URL("/dashboard?discord=user_error", baseUrl));
  }

  await db.query(
    `
    INSERT INTO user_accounts (
      email,
      google_name,
      discord_user_id,
      discord_username,
      discord_global_name,
      discord_avatar,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (email)
    DO UPDATE SET
      google_name = EXCLUDED.google_name,
      discord_user_id = EXCLUDED.discord_user_id,
      discord_username = EXCLUDED.discord_username,
      discord_global_name = EXCLUDED.discord_global_name,
      discord_avatar = EXCLUDED.discord_avatar,
      updated_at = NOW()
    `,
    [
      session.user.email,
      session.user.name ?? null,
      discordUser.id,
      discordUser.username,
      discordUser.global_name ?? null,
      discordUser.avatar ?? null,
    ],
  );

  return NextResponse.redirect(getDiscordBotInviteUrl());
}

function getBaseUrl() {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
