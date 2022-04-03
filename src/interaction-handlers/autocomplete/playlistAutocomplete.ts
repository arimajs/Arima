import type { AutocompleteInteraction, CommandInteraction, Snowflake } from 'discord.js';
import type { Awaitable } from '@sapphire/utilities';
import type { Playlist } from '#entities/Playlist';
import { from, container, InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ObjectId, type EntityRepository } from '@mikro-orm/mongodb';
import { QueryOrder, type FindOptions } from '@mikro-orm/core';
import { ApplyOptions } from '@sapphire/decorators';
import { pluralize } from '#utils/common';
import { sendError } from '#utils/responses';
import Fuse from 'fuse.js/dist/fuse.basic.min.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Autocomplete
})
export class PlaylistAutocompleteHandler extends InteractionHandler {
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

	/**
	 * Discord autocomplete suggestions can easily be ignored by the user, so this method can be used in commands to
	 * double check that recieved IDs are valid (24 character hex string), and the playlists they correspond to belong to the user.
	 *
	 * @example
	 * const playlist = await PlaylistAutocompleteHandler.resolve(interaction, (query, playlists) => playlists.findOne(query));
	 * if (!playlist) {
	 *     return;
	 * }
	 */
	public static async resolve<T>(
		interaction: CommandInteraction,
		checkExistence: (query: { _id: ObjectId; creator: Snowflake }, playlists: EntityRepository<Playlist>) => Awaitable<T>
	) {
		const playlist = interaction.options.getString('playlist', true);
		const _id = from(() => new ObjectId(playlist));

		const res = _id.success && (await checkExistence({ _id: _id.value, creator: interaction.user.id }, container.db.playlists));
		return res || sendError(interaction, `That playlist doesn't exist!`, { tip: "Make sure you're using the autocomplete menu" });
	}
}
