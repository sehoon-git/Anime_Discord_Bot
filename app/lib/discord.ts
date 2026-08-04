const DEFAULT_BOT_INVITE_URL =
  "https://discord.com/oauth2/authorize?client_id=1533876491312697344&permissions=2150714368&integration_type=0&scope=bot+applications.commands";

export function getDiscordBotInviteUrl() {
  return process.env.DISCORD_BOT_INVITE_URL ?? DEFAULT_BOT_INVITE_URL;
}
