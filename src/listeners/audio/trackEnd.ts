import type { IncomingEventTrackEndPayload } from '@skyra/audio';
import { AcceptedAnswer, GameEndReason } from '#game/Game';
import { BrandingColors } from '#utils/constants';
import { LavalinkEvent } from '#utils/audio';
import { ApplyOptions } from '@sapphire/decorators';
import { createEmbed } from '#utils/responses';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: LavalinkEvent.TrackEnd })
export class UserListener extends Listener {
	public async run(payload: IncomingEventTrackEndPayload) {
		console.log({ payload });
		const game = this.container.games.get(payload.guildId);

		if (!game) {
			return;
		}

		const guessers = game.guessersThisRound;
		const requiredBoth = game.acceptedAnswer === AcceptedAnswer.Both;
		const guessed = guessers.length === 2 ?? (guessers.length && !requiredBoth);

		if (guessed) {
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

		const [streakLeaderId, streak] = game.streaks.leader ?? [];

		// If there is a streak leader, it must be one of the guessers.
		const streakLeader = streak && guessers.find(({ id }) => id === streakLeaderId);
		if (streakLeader) {
			footerText += ` • ${streakLeader.tag} has a streak of ${streak} 🔥`;
		}

		if (game.goal) {
			footerText += ` • Playing to ${game.goal} points`;
		}

		const { title, author, uri } = game.queue.currentlyPlaying!.info;
		const embedTitle = guessed
			? `${guessers.join(' and ')} guessed it! 🎉`
			: `${game.guessedThisRound ? `Only the ${game.guessedThisRound} was guessed` : `Nobody got it`}! 🙁`;

		const embed = createEmbed(embedTitle, BrandingColors.Secondary)
			.setURL(uri)
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
			console.log(15);
			await game.end(GameEndReason.GoalMet);
		}

		await game.queue.next();
	}
}
