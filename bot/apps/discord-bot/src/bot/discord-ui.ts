import { EmbedBuilder } from 'discord.js';

const SELINE_PINK = 0xe98ab5;
const DEFAULT_SELINE_AVATAR_URL = 'https://anime-discord-bot-rw3b.vercel.app/seline-icon.png';

function selineAvatarUrl(): string {
  return process.env.SELINE_AVATAR_URL?.trim() || DEFAULT_SELINE_AVATAR_URL;
}

export function createSelineEmbed(text: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SELINE_PINK)
    .setAuthor({ name: 'Seline', iconURL: selineAvatarUrl() })
    .setDescription(text)
    .setFooter({ text: 'Discord Anime AI' });
}
