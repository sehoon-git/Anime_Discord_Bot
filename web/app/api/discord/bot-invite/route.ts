import { NextResponse } from "next/server";
import { getDiscordBotInviteUrl } from "@/app/lib/discord";

export async function GET() {
  return NextResponse.redirect(getDiscordBotInviteUrl());
}
