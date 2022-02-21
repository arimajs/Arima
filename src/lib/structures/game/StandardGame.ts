import type { Message, Snowflake, User } from 'discord.js';
import { Game, AcceptedAnswer, GameType } from '#game/Game';
import { resolveThumbnail } from '#utils/audio';
import { BrandingColors } from '#utils/constants';
import { createEmbed } from '#utils/responses';
import { container } from '@sapphire/framework';

export class StandardGame extends Game {
	public readonly gameType = GameType.Standard;

	public async guess(message: Message) {
		const guess = message.content.toLowerCase();
		const guessedBefore = this.guessedThisRound();
		const guessedNow = this.processGuess(guess, message.author.id);

		if (!guessedNow) {
			return;
		}

		const isHalfGuessed = this.acceptedAnswer === AcceptedAnswer.Both && !guessedBefore && guessedNow;

		let halfGuessedString = '';
		if (isHalfGuessed) {
			const { title, author } = this.queue.nowPlaying!.info;
			const guessedNameString = guessedNow === AcceptedAnswer.Song ? title : author;
			halfGuessedString = ` The ${guessedNow}'s name is **${guessedNameString}**. You're halfway there!`;
		}

		const embed = createEmbed(`✅ You got it!${halfGuessedString}`);

		const promises: Promise<unknown>[] = [];
		promises.push(message.channel.send({ embeds: [embed] }));

		if (!isHalfGuessed) {
			promises.push(this.queue.player.stop());
		}

		await Promise.all(promises);
	}

	public async onTrackEnd() {
		const everybodyPassed = this.round.passedPlayers.size === this.players.size;

		const { tracksPlayed, playlistLength, nowPlaying } = this.queue;
		let embedFooter = `${tracksPlayed}/${playlistLength}`;
		let embedDescription = everybodyPassed ? 'Everybody passed! 🏃‍♂️' : 'Nobody got it! 🙁';

		if (!everybodyPassed) {
			const { songGuessers, primaryArtistGuessers } = this.round;

			// Ensure players are only in here once.
			const uniqueGuessers = [...new Set([...songGuessers, ...primaryArtistGuessers])];
			const usersOrNull = await Promise.all(uniqueGuessers.map((id) => container.client.users.fetch(id).catch(() => null)));
			const guessers = usersOrNull.filter(Boolean) as User[];

			const numGuessers = guessers.length;
			const requiresBoth = this.acceptedAnswer === AcceptedAnswer.Both;
			const doubleGuesser = requiresBoth && numGuessers === 1 && songGuessers.length && primaryArtistGuessers.length;

			// 3 cases that the song was 'guessed':
			//   - someone got it (one or either of artist or song)
			//   - 1 person got both
			//   - two different people got 1 each
			const guessed = (!requiresBoth && numGuessers) || doubleGuesser || numGuessers === 2;

			if (guessed) {
				if (numGuessers === 1) {
					this.leaderboard.inc(guessers[0].id);
				} else {
					// There should only ever be 2 guessers but made generic anyway.
					for (const guesser of guessers) {
						this.leaderboard.inc(guesser.id, 1 / numGuessers);
					}
				}

				this.streaks.incStreak(...guessers.map(({ id }) => id));

				embedDescription = `${doubleGuesser ? guessers[0] : guessers.join(' and ')} guessed it!`;
			}

			const [streakLeaderId, streak] = this.streaks.leader ?? [];

			// If there is a streak leader, it must be one of the guessers.
			const streakLeader = streak && guessers.find(({ id }) => id === streakLeaderId);
			if (streakLeader) {
				embedFooter += ` • ${streakLeader.tag} has a streak of ${streak} 🔥`;
			}

			const guessedThisRound = this.guessedThisRound();
			if (guessedThisRound) {
				embedDescription = `Only the ${guessedThisRound} was guessed! 🙁`;
			}
		}

		if (this.goal && !this.limit) {
			embedFooter += ` • Playing to ${this.goal} points`;
		} else if (this.limit && !this.goal) {
			embedFooter += ` • Playing to ${this.limit} songs`;
		} else if (this.limit && this.goal) {
			embedFooter += ` • Playing to ${this.goal} points or ${this.limit} songs`;
		}

		const { title, author, uri, color } = nowPlaying!.info;

		const embed = createEmbed(embedDescription, BrandingColors.Secondary)
			.setURL(uri)
			.setTitle(`That was "${title}" by ${author}`)
			.addField('Leaderboard', this.leaderboard.compute())
			.setFooter({ text: embedFooter });

		if (color) {
			embed.setColor(color);
		}

		const thumbnail = resolveThumbnail(nowPlaying!.info);
		if (thumbnail) {
			embed.setThumbnail(thumbnail);
		}

		await this.textChannel.send({ embeds: [embed] });
	}

	/**
	 * Processes a guess returning whether either the song name or primary artist was guessed
	 */
	protected processGuess(guess: string, user: Snowflake) {
		switch (this.acceptedAnswer) {
			case AcceptedAnswer.Song: {
				return this.processSongGuess(guess, user) ? AcceptedAnswer.Song : null;
			}

			case AcceptedAnswer.Artist: {
				return this.processArtistGuess(guess, user) ? AcceptedAnswer.Artist : null;
			}

			case AcceptedAnswer.Either: {
				break;
			}

			case AcceptedAnswer.Both: {
				// If the song is guessed, guess the artists.
				if (this.round.songGuessers.length) {
					return this.processArtistGuess(guess, user) ? AcceptedAnswer.Artist : null;
				}

				// If neither is already guessed, guess both.
				break;
			}
		}

		// Guessing either is common to AcceptedAnswer.Either and AcceptedAnswer.Both
		if (this.processArtistGuess(guess, user)) {
			return AcceptedAnswer.Artist;
		}

		if (this.processSongGuess(guess, user)) {
			return AcceptedAnswer.Song;
		}

		return null;
	}

	private guessedThisRound() {
		// Check if someone guessed song name or primary artist.
		if (this.round.songGuessers.length) {
			return AcceptedAnswer.Song;
		}

		if (this.round.primaryArtistGuessers.length) {
			return AcceptedAnswer.Artist;
		}

		return null;
	}
}
