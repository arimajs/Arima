import type { AutocompleteInteraction } from 'discord.js';
import type { Playlist } from '#entities/Playlist';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { QueryOrder, type FindOptions } from '@mikro-orm/core';
import { ApplyOptions } from '@sapphire/decorators';
import { pluralize } from '#utils/common';
import Fuse from 'fuse.js/dist/fuse.basic.min.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Autocomplete
})
export class PlaylistAutocompleteInteractionHandler extends InteractionHandler {
	public override async run(interaction: AutocompleteInteraction, result: InteractionHandler.ParseResult<this>) {
		return interaction.respond(result);
	}

	public override async parse(interaction: AutocompleteInteraction) {
		const { name, value: query } = interaction.options.getFocused(true);

		// This handler only checks that it's being used for an autocomplete option with the name of "playlist", which
		// makes it dynamically reusable across multiple commands.
		if (name !== 'playlist') {
			return this.none();
		}

		// If there is no query, return the user's top 25 most listened to playlists.
		const querylessSpecificOptions: FindOptions<Playlist> = { orderBy: { listenCount: QueryOrder.DESC }, limit: 25 };
		const playlists = await this.container.db.playlists.find(
			{ creator: interaction.user.id },
			{ fields: ['name', 'tracks'], ...(query ? querylessSpecificOptions : undefined) }
		);

		if (query) {
			const fuzzerSearcher = new Fuse(playlists, { keys: ['name'] });
			const results = fuzzerSearcher.search(query as string, { limit: 25 });

			return this.some(
				results.map(({ item }) => ({
					name: `${item.name} (${pluralize('song', item.tracks.length)})`,
					value: item.id
				}))
			);
		}

		return this.some(
			playlists.map(({ name, tracks, id }, idx) => ({
				// A star will signify the user's top 3 listened to playlists.
				name: `${idx < 3 ? '⭐ ' : ''}${name} (${pluralize('song', tracks.length)})`,
				value: id
			}))
		);
	}
}
