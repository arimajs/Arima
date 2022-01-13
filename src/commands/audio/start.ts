/* eslint-disable @typescript-eslint/member-ordering */
import type { CommandInteraction } from 'discord.js';
import { CommandOptionsRunTypeEnum, isErr, type ApplicationCommandRegistry } from '@sapphire/framework';
import { PlaylistResolutionError, resolvePlaylist } from '#utils/audio';
import { AcceptedAnswer, Game } from '#game/Game';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { sendError } from '#utils/responses';
import { env } from '#root/config';

@ApplyOptions<ArimaCommand.Options>({
	description: 'Start a new music quiz game!',
	requiredClientPermissions: PermissionFlagsBits.Connect | PermissionFlagsBits.Speak,
	runIn: [CommandOptionsRunTypeEnum.GuildText],
	preconditions: [{ name: 'PlayingGame', context: { shouldBePlaying: false } }]
})
export class UserCommand extends ArimaCommand {
	private static errorDescriptors = {
		[PlaylistResolutionError.NotEnoughTracks]: 'There must be at least 5 tracks over 30 seconds long',
		[PlaylistResolutionError.NotFound]: "I couldn't find that playlist. Please make sure you entered a valid URL",
		[PlaylistResolutionError.NotPlaylist]: "The link you sent didn't lead to a playlist",
		[PlaylistResolutionError.NotSuccessful]: `Something went wrong when finding that playlist. Please try again later, or submit a bug report on my [support server](<${env.SUPPORT_SERVER_INVITE}>)`
	};

	public override async chatInputRun(interaction: CommandInteraction<'cached'>) {
		if (interaction.member.voice.channel?.type !== 'GUILD_VOICE') {
			return sendError(interaction, 'You must be in a voice channel to start a game');
		}

		const goal = interaction.options.getInteger('goal');
		if (goal && goal < 5) {
			return sendError(interaction, 'Your goal must be at least 5 points');
		}

		const url = interaction.options.getString('url', true);
		const result = await resolvePlaylist(url);

		if (isErr(result)) {
			return sendError(interaction, UserCommand.errorDescriptors[result.error]);
		}

		const game = new Game({
			hostUser: interaction.user,
			playlist: result.value,
			textChannel: interaction.channel!,
			voiceChannel: interaction.member.voice.channel,
			acceptedAnswer: (interaction.options.getString('answers') as AcceptedAnswer) ?? undefined,
			goal: goal ?? undefined
		});

		await game.start(interaction);
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addStringOption((builder) =>
					builder
						.setName('url')
						.setDescription('The URL of the Youtube/Soundcloud/Bandcamp/Spotify playlist to play! (Or Spotify album/artist)')
						.setRequired(true)
				)
				.addIntegerOption((builder) =>
					builder //
						.setName('goal')
						.setDescription('The amount of points to play to! (Optional)')
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
				)
		);
	}
}
