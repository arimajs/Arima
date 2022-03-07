/* eslint-disable @typescript-eslint/member-ordering */
import { createEmbed, sendError } from '#utils/responses';
import { UseRequestContext } from '#utils/decorators';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<ArimaCommand.Options>({
	description: 'Execute functions related to cutsom playlists!'
})
export class UserCommand extends ArimaCommand {
	@UseRequestContext()
	public override async chatInputRun(interaction: ArimaCommand.Interaction) {
		const subcommand = interaction.options.getSubcommand(true);
		if (subcommand === 'create') {
			await this.create(interaction);
		}
	}

	public async create(interaction: ArimaCommand.Interaction) {
		const { playlists } = this.container.db;

		const name = interaction.options.getString('name', true);
		const existingPlaylists = await playlists.find({ creator: interaction.user.id });

		if (existingPlaylists.some((playlist) => playlist.name === name)) {
			return sendError(interaction, 'You already have a playlist with that name');
		}

		if (existingPlaylists.length >= 5) {
			return sendError(interaction, "Currently, you can't have more 5 playlists");
		}

		const playlist = playlists.create({ creator: interaction.user.id, name });
		await playlists.persistAndFlush(playlist);

		const embed = createEmbed('✅ Successfully created playlist!').setFooter({
			text: `You now have ${existingPlaylists.length + 1} playlists 🎵`
		});

		await interaction.reply({ embeds: [embed] });
	}

	public override registerApplicationCommands(registry: ArimaCommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('create')
						.setDescription('Create a custom playlist!')
						.addStringOption((option) =>
							option //
								.setName('name')
								.setDescription("The name of the playlist! (You won't be able to edit this later)")
						)
				)
		);
	}
}
