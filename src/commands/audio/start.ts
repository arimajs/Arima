/* eslint-disable @typescript-eslint/member-ordering */
import type { GameData } from '#game/Game';
import { AcceptedAnswer, PlaylistResolutionError, GameType } from '#types/Enums';
import { CommandOptionsRunTypeEnum, isErr } from '@sapphire/framework';
import { hideLinkEmbed, hyperlink } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { resolvePlaylist } from '#utils/audio';
import { StandardGame } from '#game/StandardGame';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { sendError } from '#utils/responses';
import { BinbGame } from '#game/BinbGame';
import { env } from '#root/config';

/**
 * Map from GameTypes to Game subclasses
 */
const Games = {
	[GameType.Standard]: StandardGame,
	[GameType.Binb]: BinbGame
};

@ApplyOptions<ArimaCommand.Options>({
	description: 'Start a new music quiz game!',
	runIn: [CommandOptionsRunTypeEnum.GuildText],
	requiredClientPermissions: PermissionFlagsBits.EmbedLinks,
	preconditions: [{ name: 'PlayingGame', context: { shouldBePlaying: false } }]
})
export class UserCommand extends ArimaCommand {
	private static errorDescriptors = {
		[PlaylistResolutionError.NotEnoughTracks]: 'There must be at least 5 tracks over 30 seconds long',
		[PlaylistResolutionError.NotFound]: "I couldn't find that playlist. Please make sure you entered a valid URL",
		[PlaylistResolutionError.NotPlaylist]: "The link you sent didn't lead to a playlist",
		[PlaylistResolutionError.NotSuccessful]: `Something went wrong when finding that playlist. Please try again later, or submit a bug report on my ${hyperlink(
			'support server',
			hideLinkEmbed(env.SUPPORT_SERVER_INVITE)
		)}`
	};

	public override async chatInputRun(interaction: ArimaCommand.Interaction<'cached'>) {
		const { channel } = interaction.member.voice;
		if (channel?.type !== 'GUILD_VOICE') {
			return sendError(interaction, 'You must be in a voice channel to start a game');
		}

		// Check that Arima has sufficient permissions.
		const permissions = channel.permissionsFor(interaction.guild.me!)!;

		// Administrators can join voice channels even if they are full.
		if (channel.full && !permissions.has(PermissionFlagsBits.Administrator)) {
			return sendError(interaction, 'Your voice channel is full');
		}

		if (!permissions.has(PermissionFlagsBits.Connect)) {
			return sendError(interaction, "I don't have permissions to join your voice channel");
		}

		if (!permissions.has(PermissionFlagsBits.Speak)) {
			return sendError(interaction, "I don't have permissions to speak in your voice channel");
		}

		const goal = interaction.options.getInteger('goal');
		const limit = interaction.options.getInteger('limit');

		const url = interaction.options.getString('url', true);
		const [result] = await Promise.all([resolvePlaylist(url), interaction.deferReply()]);

		if (isErr(result)) {
			return sendError(interaction, UserCommand.errorDescriptors[result.error]);
		}

		const gameType = (interaction.options.getString('mode') as GameType) ?? GameType.Standard;
		const gameData: GameData = {
			host: interaction.user,
			playlist: result.value,
			textChannel: interaction.channel!,
			voiceChannel: channel,
			acceptedAnswer: (interaction.options.getString('answers') as AcceptedAnswer) ?? undefined,
			goal: goal ?? undefined,
			limit: limit ?? undefined
		};

		const game = new Games[gameType](gameData);
		this.container.games.set(interaction.guild.id, game);
		await game.queue.player.join(channel.id, { deaf: true });
		return game.start(interaction);
	}

	public override registerApplicationCommands(registry: ArimaCommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.addStringOption((builder) =>
						builder
							.setName('url')
							.setDescription('The URL of the Youtube/Soundcloud/Bandcamp/Spotify playlist, album, or artist to play!')
							.setRequired(true)
					)
					.addStringOption((builder) =>
						builder
							.setName('mode')
							.setDescription('The game mode to play! (Optional)')
							.addChoices([
								['Trivia in this channel (Default)', GameType.Standard],
								['Competitive in DMs', GameType.Binb]
							])
							.setRequired(false)
					)
					.addIntegerOption((builder) =>
						builder //
							.setName('goal')
							.setDescription('The amount of points to play to! (Optional)')
							.setMinValue(5)
							.setRequired(false)
					)
					.addIntegerOption((builder) =>
						builder //
							.setName('limit')
							.setDescription('The number of songs to play to! (Optional)')
							.setMinValue(5)
							.setRequired(false)
					)
					.addStringOption((builder) =>
						builder
							.setName('answers')
							.setDescription('The type of answer to accept! (Optional)')
							.addChoices([
								['Song Name Only', AcceptedAnswer.Song],
								['Artist Name Only', AcceptedAnswer.Artist],
								['Either (Default)', AcceptedAnswer.Either],
								['Both', AcceptedAnswer.Both]
							])
							.setRequired(false)
					),
			{ idHints: ['937409133890633738'] }
		);
	}
}
