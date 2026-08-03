import { REST, Routes } from 'discord.js';
import { slashCommands } from './commands.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

const route = config.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID)
  : Routes.applicationCommands(config.DISCORD_CLIENT_ID);

await rest.put(route, { body: slashCommands });
console.info(
  config.DISCORD_GUILD_ID
    ? `개발 서버(${config.DISCORD_GUILD_ID})에 ${slashCommands.length}개 명령을 등록했습니다.`
    : `${slashCommands.length}개 전역 명령을 등록했습니다.`
);
