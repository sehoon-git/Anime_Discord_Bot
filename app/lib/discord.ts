const DEFAULT_BOT_INVITE_URL =
  "https://discord.com/oauth2/authorize?client_id=1533876491312697344&scope=bot+applications.commands";

export function getDiscordBotInviteUrl() {
  return process.env.DISCORD_BOT_INVITE_URL ?? DEFAULT_BOT_INVITE_URL;
}
