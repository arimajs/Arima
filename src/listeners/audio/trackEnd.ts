import type { IncomingEventTrackEndPayload } from '@skyra/audio';
import { BrandingColors } from '#utils/constants';
import { LavalinkEvent } from '#utils/audio';
import { GameEndReason } from '#game/Game';
import { ApplyOptions } from '@sapphire/decorators';
import { createEmbed } from '#utils/responses';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: LavalinkEvent.TrackEnd })
export class UserListener extends Listener {
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

		const guessers = game.guessersThisRound;

		// If there is no guesser, it means the track ended because time ran out.
		if (guessers.length) {
			// TODO: give multiple people streaks and points for `AcceptedAnswer.Both`
			if (guessers.length === 1) {
				game.leaderboard.inc(guessers[0].id);
			} else {
				game.leaderboard.inc(guessers[0].id, 0.5);
				game.leaderboard.inc(guessers[1].id, 0.5);
			}

			game.streaks.incStreak(...guessers.map(({ id }) => id));
		}

		const { tracksPlayed, playlistLength } = game.queue;
		let footerText = `${tracksPlayed}/${playlistLength}`;

		const [streakLeaderId, streak] = game.streaks.leader;

		// If there is a streak leader, it must be one of the guessers.
		const streakLeader = streak !== 0 && guessers.find(({ id }) => id === streakLeaderId);
		if (streakLeader) {
			footerText += ` • ${streakLeader.tag} has a streak of ${streak} 🔥`;
		}

		if (game.goal) {
			footerText += ` • Playing to ${game.goal} points`;
		}

		const { title, author } = game.queue.currentlyPlaying!;

		const embed = createEmbed(guessers.length ? `${guessers.join(' and ')} guessed it! 🎉` : 'Nobody got it! 🙁', BrandingColors.Secondary)
			.setTitle(`That was "${title}" by ${author}`)
			.addField('Leaderboard', game.leaderboard.compute())
			.setFooter({ text: footerText });

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
