/* eslint-disable @typescript-eslint/member-ordering */
import { createEmbed, sendError } from '#utils/responses';
import { UseRequestContext } from '#utils/decorators';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { pluralize } from '#utils/common';
import { ObjectId } from '@mikro-orm/mongodb';
import { italic } from '@discordjs/builders';
import { from } from '@sapphire/framework';

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
		const playlist = interaction.options.getString('playlist', true);

		// The id is validated here and the "creator" property is added to the query because in theory the use can
		// ignore the autocomplete options and either input something that's not an ObjectId (24 character hex string),
		// or an ObjectId that corresponds to a playlist that's not theirs.
		const _id = from(() => new ObjectId(playlist));

		// If `new ObjectId(...)` threw an error, exit early. Otherwise, send a delete query, which will return
		// the number of "affected rows" (documents deleted). If the number is 0, the playlist doesn't exist.
		const deleted = _id.success && (await this.container.db.playlists.nativeDelete({ _id: _id.value, creator: interaction.user.id }));
		if (!deleted) {
			return sendError(interaction, `That playlist doesn't exist!\n${italic("💡Make sure you're using the autocomplete menu")}`);
		}

		const embed = createEmbed('✅ Successfully deleted playlist!');
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
							option
								.setName('name')
								.setDescription("The name of the playlist! (You won't be able to edit this later)")
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
		);
	}
}
