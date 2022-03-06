import { GatewayDispatchEvents, type APITextChannel } from 'discord-api-types/v9';
import { GameEndReason } from '#types/Enums';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

// This event is run if a channel is deleted. If the channel is the assigned voice or text channel for a game, it should
// be ended, as there would be no way to continue (either you wouldn't have a channel to guess in or a channel to listen
// to in)
@ApplyOptions<Listener.Options>({ event: GatewayDispatchEvents.ChannelDelete, emitter: 'ws' })
export class RawChannelDeleteListener extends Listener {
	// The real type is `APIChannel`, but I used `APITextChannel` to avoid certain Typescript issues.
	public async run(data: APITextChannel) {
		// Exit early if it's a DM channel.
		if (!data.guild_id) {
			return;
		}

		const game = this.container.games.get(data.guild_id);
		if (game?.textChannel.id === data.id) {
			// There's an individual GameEndReason entry for the text channel being deleted because it will result in no
			// message being sent.
			await game.end(GameEndReason.TextChannelDeleted);
		} else if (game?.voiceChannel.id === data.id) {
			await game.end(GameEndReason.Other);
		}
	}
}
