/* eslint-disable unicorn/prefer-spread */
// The lint rule should only apply when concatenating arrays, but instead flags
// down Collection#concat.

import { Collection, type AutocompleteInteraction, type CommandInteraction } from 'discord.js';
import { Piece, type Store, type ApplicationCommandRegistry } from '@sapphire/framework';
import { ArimaCommand } from '#structures/ArimaCommand';
import { createEmbed } from '#utils/responses';
import { Stopwatch } from '@sapphire/stopwatch';
import { env } from '#root/config';
import Fuse from 'fuse.js/dist/fuse.basic.min.js';

export class UserCommand extends ArimaCommand {
	public override async chatInputRun(interaction: ArimaCommand.Interaction) {
		const type = interaction.options.getSubcommand(true);
		const name = interaction.options.getString('name', true);

		const timer = new Stopwatch().stop();

		if (type === 'piece') {
			const pieces = new Collection<string, Piece>().concat(...this.container.stores.values());
			const piece = pieces.get(name)!;

			timer.start();
			await piece.reload();
		} else if (type === 'store') {
			const store = this.container.stores.get(name as keyof Store.RegistryEntries)!;

			timer.start();
			await store.loadAll();
		} else {
			timer.start();
			await Promise.all(this.container.stores.map((store) => store.loadAll()));
		}

		await interaction.reply({ embeds: [createEmbed(`Reload completed in ${timer.stop().toString()} ⏱️`)] });
	}

	public override autocompleteRun(interaction: AutocompleteInteraction) {
		const type = interaction.options.getSubcommand(true);
		const query = interaction.options.getFocused() as string;

		const options =
			type === 'piece'
				? new Collection<string, Piece>()
						.concat(...this.container.stores.values())
						// Don't include builtin pieces
						.filter((piece) => !piece.location.full.includes('node_modules'))
				: this.container.stores;

		if (!query) {
			return interaction.respond(
				[...options.values()].map((item) => ({
					name: `${item.name}${item instanceof Piece ? ` (${item.store.name})` : ''}`,
					value: item.name
				}))
			);
		}

		const fuzzerSearcher = new Fuse([...options.values()], { keys: ['name'] });
		const results = fuzzerSearcher.search(query.toLowerCase(), { limit: 25 });

		return interaction.respond(
			results.map(({ item }) => ({ name: `${item.name}${item instanceof Piece ? ` (${item.store.name})` : ''}`, value: item.name }))
		);
	}

	public override registerApplicationCommands(registry: ArimaCommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription('[owner only] Reload a piece, or a store, or all of both!')
					.addSubcommand((builder) =>
						builder
							.setName('piece')
							.setDescription('Reload a piece')
							.addStringOption((builder) =>
								builder //
									.setName('name')
									.setDescription('[owner only] The name of the piece to reload')
									.setRequired(true)
									.setAutocomplete(true)
							)
					)
					.addSubcommand((builder) =>
						builder
							.setName('store')
							.setDescription('Reload a store')
							.addStringOption((builder) =>
								builder //
									.setName('name')
									.setDescription('[owner only] The name of the store to reload')
									.setRequired(true)
									.setAutocomplete(true)
							)
					)
					.addSubcommand((builder) =>
						builder //
							.setName('all')
							.setDescription('[owner only] Reload all stores and pieces')
					),
			{ idHints: ['937413389683138640'], guildIds: [env.DEV_SERVER_ID] }
		);
	}
}
