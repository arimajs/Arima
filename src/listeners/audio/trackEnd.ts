import type { IncomingEventTrackEndPayload } from '@skyra/audio';
import { BrandingColors } from '#utils/constants';
import { GameEndReason } from '#game/Game';
import { ApplyOptions } from '@sapphire/decorators';
import { createEmbed } from '#utils/responses';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: 'TrackEndEvent' })
export class UserAudioListener extends Listener {
	public async run(payload: IncomingEventTrackEndPayload) {
		// Only proceed if the track wasn't stopped because the player had
		// stopped, or because another track started playing while the current
		// had not finished.
		if (['REPLACED', 'STOPPED'].includes(payload.reason)) {
			return;
		}

		const game = this.container.games.get(payload.guildId);

		if (!game) {
			return;
		}

		const guesser = game.guesserThisRound;
		let streak: number | null = null;

		// If there is no guesser, it means the track ended because time ran out.
		if (guesser) {
			// TODO: give multiple people streaks and points for `AcceptedAnswer.Both`
			game.leaderboard.inc(guesser.id);
			streak = game.streaks.inc(guesser.id);
		}

		const { tracksPlayed, playlistLength } = game.queue;
		let footerText = `${tracksPlayed}/${playlistLength}`;
		if (streak ?? 0 > 2) {
			footerText += ` • ${guesser!.tag} has a streak of ${streak} 🔥`;
		}

		if (game.goal) {
			footerText += ` • Playing to ${game.goal} points`;
		}

		const { title, author } = game.queue.currentlyPlaying!;
		const embed = createEmbed(guesser ? `${guesser} guessed it! 🎉` : 'Nobody got it! 🙁', BrandingColors.Secondary)
			.setTitle(`That was "${title}" by ${author}`)
			.addField('Leaderboard', game.leaderboard.compute())
			.setFooter(footerText);

		await game.textChannel.send({ embeds: [embed] });

		game.players.forEach((player) => {
			// If the player is still in the voice channel (this property is
			// turned to undefined when they leave).
			if (player.lastGameEntryTime) {
				player.songsListenedTo++;
			}
		});

		const points = game.leaderboard.leader?.[1];
		if (points && game.goal && points === game.goal) {
			await game.end(GameEndReason.GoalMet);
		}

		await game.queue.next();
	}
}
