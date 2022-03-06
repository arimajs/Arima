import type { IncomingEventTrackExceptionPayload } from '@skyra/audio';
import { hideLinkEmbed, hyperlink, italic } from '@discordjs/builders';
import { EmbedColor, LavalinkEvent } from '#types/Enums';
import { bold, redBright } from 'colorette';
import { ApplyOptions } from '@sapphire/decorators';
import { createEmbed } from '#utils/responses';
import { Listener } from '@sapphire/framework';
import { env } from '#root/config';

@ApplyOptions<Listener.Options>({ event: LavalinkEvent.TrackException })
export class TrackExceptionListener extends Listener {
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

		const embed = createEmbed(
			`❌ Something went wrong whilst playing a track! Skipping...\n${italic(
				`Want to report the issue? Join my ${hyperlink('support server', hideLinkEmbed(env.SUPPORT_SERVER_INVITE))}!`
			)}`,
			EmbedColor.Error
		);

		// Decrement the playlist length, as it is used to calculate how many songs were played, and this song wasn't.
		game.queue.playlistLength--;
		return Promise.all([game.queue.player.stop(), game.textChannel.send({ embeds: [embed] })]);
	}
}
