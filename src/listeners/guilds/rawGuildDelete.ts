import { GatewayGuildDeleteDispatchData, GatewayDispatchEvents } from 'discord-api-types/v9';
import { GameEndReason } from '#game/Game';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

// This event is run if a guild is deleted or is deemed unavailable due to an
// outage from Discord. This listener is attached directly on `ws` because the
// game should end regardless of whether the guild is cached.
@ApplyOptions<Listener.Options>({ event: GatewayDispatchEvents.GuildDelete, emitter: 'ws' })
export class UserListener extends Listener {
	public async run(data: GatewayGuildDeleteDispatchData) {
		const game = this.container.games.get(data.id);
		await game?.end(GameEndReason.GuildInaccessible);
	}
}
