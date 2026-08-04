import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.redirect(
      new URL("/api/auth/signin/google?callbackUrl=/dashboard", getBaseUrl()),
    );
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const baseUrl = getBaseUrl();

  if (!clientId) {
    return NextResponse.json(
      { error: "DISCORD_CLIENT_ID is missing" },
      { status: 500 },
    );
  }

  const state = randomUUID();
  const cookieStore = await cookies();

  cookieStore.set("discord_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: baseUrl.startsWith("https://"),
    maxAge: 60 * 10,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/api/discord/callback`,
    response_type: "code",
    scope: "identify",
    state,
  });

  return NextResponse.redirect(`${DISCORD_AUTHORIZE_URL}?${params.toString()}`);
}

function getBaseUrl() {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
