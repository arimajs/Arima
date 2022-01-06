import type { IncomingEventTrackExceptionPayload } from '@skyra/audio';
import { BrandingColors } from '#utils/constants';
import { ApplyOptions } from '@sapphire/decorators';
import { createEmbed } from '#utils/responses';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: 'TrackExceptionEvent' })
export class UserAudioListener extends Listener {
	public async run(payload: IncomingEventTrackExceptionPayload) {
		const game = this.container.games.get(payload.guildId);
		if (!game) {
			return;
		}

		const embed = createEmbed(`❌ Something went wrong whilst playing "${payload.track}"! Skipping...`, BrandingColors.Error);
		await game.textChannel.send({ embeds: [embed] });
		await game.queue.next();
	}
}
