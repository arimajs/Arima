/* eslint-disable @typescript-eslint/member-ordering */
import { AcceptedAnswer, PlaylistResolutionError } from '#types/Enums';
import { CommandOptionsRunTypeEnum, isErr } from '@sapphire/framework';
import { hideLinkEmbed, hyperlink } from '@discordjs/builders';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { resolvePlaylist } from '#utils/audio';
import { StandardGame } from '#game/StandardGame';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { sendError } from '#utils/responses';
import { env } from '#root/config';

@ApplyOptions<ArimaCommand.Options>({
	description: 'Start a new music quiz game!',
	runIn: [CommandOptionsRunTypeEnum.GuildText],
	requiredClientPermissions: PermissionFlagsBits.EmbedLinks,
	preconditions: [{ name: 'PlayingGame', context: { shouldBePlaying: false } }]
})
export class StartCommand extends ArimaCommand {
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
			return sendError(interaction, StartCommand.errorDescriptors[result.error]);
		}

		const game = new StandardGame({
			host: interaction.user,
			playlist: result.value,
			textChannel: interaction.channel!,
			voiceChannel: channel,
			acceptedAnswer: (interaction.options.getString('answers') as AcceptedAnswer) ?? undefined,
			goal: goal ?? undefined,
			limit: limit ?? undefined
		});

		await game.queue.player.join(channel.id, { deaf: true });
		await game.start(interaction);

		return this.container.games.set(interaction.guild.id, game);
	}

	public override registerApplicationCommands(registry: ArimaCommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.addStringOption((option) =>
						option
							.setName('url')
							.setDescription('The URL of the Youtube/Soundcloud/Bandcamp/Spotify playlist, album, or artist to play!')
							.setRequired(true)
					)
					.addIntegerOption((option) =>
						option //
							.setName('goal')
							.setDescription('The amount of points to play to! (Optional)')
							.setMinValue(5)
							.setRequired(false)
					)
					.addIntegerOption((option) =>
						option //
							.setName('limit')
							.setDescription('The number of songs to play to! (Optional)')
							.setMinValue(5)
							.setRequired(false)
					)
					.addStringOption((option) =>
						option
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
