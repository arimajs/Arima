/* eslint-disable @typescript-eslint/member-ordering */
import { bold, inlineCode, time, TimestampStyles } from '@discordjs/builders';
import { PlaylistAutocompleteHandler } from '#autocomplete/playlistAutocomplete';
import { createEmbed, sendError } from '#utils/responses';
import { UseRequestContext } from '#utils/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { ArimaCommand } from '#structures/ArimaCommand';
import { pluralize } from '#utils/common';
import { chunk } from '@sapphire/utilities';

export class PlaylistCommand extends ArimaCommand {
	@UseRequestContext()
	public override async chatInputRun(interaction: ArimaCommand.Interaction) {
		// This type is a bit weird, but boils down to the name of every method in this class that takes only one
		// argument (interaction) and returns `Promise<void>`. This way, methods with the same name as subcommands can
		// be dynamically run.
		const subcommand = interaction.options.getSubcommand(true) as keyof {
			[K in keyof PlaylistCommand as PlaylistCommand[K] extends PlaylistCommand['chatInputRun'] ? K : never]: never;
		};

		await this[subcommand]?.(interaction);
	}

	public async create(interaction: ArimaCommand.Interaction) {
		const { playlists } = this.container.db;

		const name = interaction.options.getString('name', true);
		const existingPlaylists = await playlists.find({ creator: interaction.user.id }, { fields: ['name'] });

		if (existingPlaylists.some((playlist) => playlist.name === name)) {
			return sendError(interaction, 'You already have a playlist with that name');
		}

		if (existingPlaylists.length >= 5) {
			return sendError(interaction, "Currently, you can't have more 5 playlists");
		}

		const playlist = playlists.create({ creator: interaction.user.id, name });
		await playlists.persistAndFlush(playlist);

		const embed = createEmbed('✅ Successfully created playlist!').setFooter({
			text: `You now have ${pluralize('playlist', existingPlaylists.length + 1)} 🎵`
		});

		await interaction.reply({ embeds: [embed] });
	}

	public async delete(interaction: ArimaCommand.Interaction) {
		const deleted = await PlaylistAutocompleteHandler.resolve(interaction, (query, playlists) => playlists.nativeDelete(query));
		if (!deleted) {
			return;
		}

		const embed = createEmbed('✅ Successfully deleted playlist!').setFooter({
			text: `You now have ${pluralize('playlist', await this.container.db.playlists.count({ creator: interaction.user.id }))} 🎵`
		});

		await interaction.reply({ embeds: [embed] });
	}

	public async info(interaction: ArimaCommand.Interaction) {
		const playlist = await PlaylistAutocompleteHandler.resolve(interaction, (query, playlists) =>
			playlists.findOne(query, { populate: ['tracks'] })
		);

		if (!playlist) {
			return;
		}

		const items = playlist.tracks.getItems();

		const decodedTracks = await this.container.audio.decode(items.map(({ track }) => track));

		// Track urls are sorted by specificity. If a Spotify url is present, it will be first, and we'll generally want
		// use it over Youtube.
		const tracks = items.map((track, idx) => ({ ...decodedTracks[idx].info, url: track.urls[0] }));

		const stats = [
			['Created', `${time(playlist.createdAt, TimestampStyles.RelativeTime)} (${time(playlist.createdAt)})`],
			['Tracks', playlist.tracks.length],
			['Listen Count', playlist.listenCount]
		] as const;

		const template = createEmbed()
			.setTitle(`"${playlist.name}"`)
			.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
			.setDescription(stats.map(([key, value]) => `${bold(key)}: ${value}`).join('\n'));

		const handler = new PaginatedMessage({ template });

		for (const [chunkIdx, chunkedTracks] of chunk(tracks, 5).entries()) {
			const indexOffset = chunkIdx * 5;
			const description = chunkedTracks.map((track, idx) => {
				const position = bold(`[${inlineCode(`${indexOffset + idx + 1}`)}]`);

				// TODO: Check if the user is currently playing a game with the playlist. If so, censor the
				// currently playing song and artist title and add some indicator that it's currently playing.
				return `${position} [${track.title} - ${track.author}](${track.url})`;
			});

			handler.addPageEmbed((embed) =>
				embed
					.setDescription(`${embed.description}\n${description.join('\n')}`)
					.setFooter({ text: `Showing songs ${indexOffset}-${indexOffset + 5}` })
			);
		}

		await handler.run(interaction);
	}

	public override registerApplicationCommands(registry: ArimaCommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription('Execute functions related to cutsom playlists!')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('create')
						.setDescription('Create a custom playlist!')
						.addStringOption((option) =>
							option
								.setName('name') //
								.setDescription('The name of the playlist!')
								.setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('delete')
						.setDescription('Delete a custom playlist!')
						.addStringOption((option) =>
							option
								.setName('playlist')
								.setDescription('The name of the playlist you want to delete!')
								.setRequired(true)
								.setAutocomplete(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('info')
						.setDescription('Get info on one of your custom playlists!')
						.addStringOption((option) =>
							option
								.setName('playlist')
								.setDescription('The name of the playlist you want to view!')
								.setRequired(true)
								.setAutocomplete(true)
						)
				)
		);
	}
}
