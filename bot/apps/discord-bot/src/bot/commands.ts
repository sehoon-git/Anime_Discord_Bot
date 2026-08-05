import { SlashCommandBuilder } from 'discord.js';

export const slashCommands = [
  new SlashCommandBuilder()
    .setName('loveai')
    .setDescription('Seline and LoveAI controls.')
    .addSubcommand((subcommand) => subcommand.setName('help').setDescription('Show LoveAI command help.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('chat')
        .setDescription('Send a text message to Seline.')
        .addStringOption((option) => option.setName('message').setDescription('Message to send.').setRequired(true).setMaxLength(1_500))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('snsmode')
        .setDescription('Choose relaxed SNS-style text replies or standard text replies.')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Your text reply style.')
            .setRequired(true)
            .addChoices(
              { name: 'SNS style (default)', value: 'on' },
              { name: 'Standard text', value: 'off' }
            )
        )
    )    .addSubcommand((subcommand) => subcommand.setName('credit').setDescription('Show your development credit balance.'))
    .addSubcommand((subcommand) => subcommand.setName('usage').setDescription('Show credit usage and remaining balance.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('model')
        .setDescription('Show available models or switch the server model.')
        .addStringOption((option) => option.setName('model').setDescription('Allowed Gemini model name.').setRequired(false))
    )
    .addSubcommand((subcommand) => subcommand.setName('voicejoin').setDescription('Make Seline join your current voice channel.'))
    .addSubcommand((subcommand) => subcommand.setName('voiceleave').setDescription('Make Seline leave the voice channel.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('voicemode')
        .setDescription('Choose automatic follow or manual voice joining.')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Voice join behavior for this server.')
            .setRequired(true)
            .addChoices(
              { name: 'Automatic follow', value: 'auto' },
              { name: 'Manual (/loveai voicejoin)', value: 'manual' }
            )
        )
    )
].map((command) => command.toJSON());