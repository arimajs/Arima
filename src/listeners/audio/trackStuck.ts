import type { IncomingEventTrackStuckPayload } from '@skyra/audio';
import { LavalinkEvent } from '#utils/audio';
import { ApplyOptions } from '@sapphire/decorators';
import { createEmbed } from '#utils/responses';
import { setTimeout } from 'node:timers';
import { Listener } from '@sapphire/framework';
import { Time } from '@sapphire/time-utilities';

@ApplyOptions<Listener.Options>({ event: LavalinkEvent.TrackStuck })
export class UserListener extends Listener {
	public async run(payload: IncomingEventTrackStuckPayload) {
		if (payload.thresholdMs < 1000) {
			return;
		}

		const game = this.container.games.get(payload.guildId);
		if (!game) {
			return;
		}

		const description = `🔃 I'm having trouble playing music. Please wait ${Math.ceil(payload.thresholdMs / Time.Second)} more seconds!`;
		const embed = createEmbed(description);
		const response = await game.textChannel.send({ embeds: [embed] });

		setTimeout(() => response.delete().catch(() => null), payload.thresholdMs);
	}
}
