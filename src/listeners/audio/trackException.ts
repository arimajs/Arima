import type { IncomingEventTrackExceptionPayload } from '@skyra/audio';
import { BrandingColors } from '#utils/constants';
import { ApplyOptions } from '@sapphire/decorators';
import { createEmbed } from '#utils/responses';
import { Listener } from '@sapphire/framework';
import { bold, redBright } from 'colorette';

@ApplyOptions<Listener.Options>({ event: 'TrackExceptionEvent' })
export class UserListener extends Listener {
	public async run(payload: IncomingEventTrackExceptionPayload) {
		const game = this.container.games.get(payload.guildId);
		if (!game) {
			return;
		}

		if (payload.exception) {
			this.container.logger.error(
				`${redBright(bold('[LAVALINK]'))} Exception (${payload.exception.severity}) while playing "${payload.track}"\n${
					payload.exception.message
				}`
			);
		}

		const embed = createEmbed(`❌ Something went wrong whilst playing "${payload.track}"! Skipping...`, BrandingColors.Error);
		await game.textChannel.send({ embeds: [embed] });
		await game.queue.next();
	}
}
