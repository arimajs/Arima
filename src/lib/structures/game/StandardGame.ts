import { Game, AcceptedAnswer, GameData, GameType } from '#game/Game';
import { createEmbed } from '#utils/responses';
import { BrandingColors } from '#utils/constants';

import type { Message, User } from 'discord.js';

export class StandardGame extends Game {
	public constructor(data: GameData) {
		super(data, GameType.Standard);
	}

	public async guess(message: Message) {
		const guess = message.content;
		let guessedBefore = AcceptedAnswer.Neither;
		if (this.acceptedAnswer === AcceptedAnswer.Both) {
			guessedBefore = this.guessedAnswer();
		}
		const isCorrect = this.guessAnswer(guess, message.author);

		if (!isCorrect) {
			return;
		}

		const guessedNow = this.guessedAnswer();
		const isHalfGuessedNow = guessedBefore === AcceptedAnswer.Neither && guessedNow !== AcceptedAnswer.Neither;

		const halfGuessedString = isHalfGuessedNow
			? ` **"${message.content}"** is the ${guessedNow.toLowerCase()}'s name. You're halfway there!`
			: '';

		const embed = createEmbed(`✅ You got it!${halfGuessedString}`);
		const promises: Promise<unknown>[] = [];

		promises.push(message.channel.send({ embeds: [embed] }));

		if (!isHalfGuessedNow) {
			promises.push(this.queue.player.stop());
		}

		await Promise.all(promises);
	}

	public guessedAnswer(): AcceptedAnswer.Song | AcceptedAnswer.Artist | AcceptedAnswer.Neither {
		// check if someone guessed song name or primary artist
		if (this.roundData.playersGuessedTrackName.size) {
			return AcceptedAnswer.Song;
		}
		if (this.roundData.trackArtistsGuessed[this.roundData.primaryArtist].size) {
			return AcceptedAnswer.Artist;
		}

		return AcceptedAnswer.Neither;
	}

	public async onTrackEnd() {
		// I realize that this has become a lot more complicated than it used to be
		// Open to suggestions

		const playersGuessedSong = this.roundData.playersGuessedTrackName;
		const playersGuessedArtist = this.roundData.trackArtistsGuessed[this.roundData.primaryArtist];
		// union of 2 sets to get only unique players into an array
		const guessers = [...new Set([...playersGuessedSong, ...playersGuessedArtist])];
		let guessed = false;
		const requiredBoth = this.acceptedAnswer === AcceptedAnswer.Both;
		const doubleGuesser = requiredBoth && guessers.length === 1 && playersGuessedSong.size && playersGuessedArtist.size;
		const numberOfGuessers = guessers.length;

		// 3 cases that the song was 'guessed': someone got it (one or either of artist or song) || 1 person got both || two different people got 1 each
		if ((!requiredBoth && numberOfGuessers) || doubleGuesser || guessers.length === 2) {
			guessed = true;
		}

		if (guessed) {
			if (guessers.length === 1) {
				// the one person gets the point
				this.leaderboard.inc(guessers[0].id);
			} else {
				// 2 people guessed it half each
				// there should only ever be 2 here but thought I'd make it generic anyway
				for (const guesser of guessers) {
					this.leaderboard.inc(guesser.id, 1 / guessers.length);
				}
			}

			this.streaks.incStreak(...guessers.map(({ id }) => id));
		}

		const { tracksPlayed, playlistLength, currentlyPlaying } = this.queue;
		let footerText = `${tracksPlayed}/${playlistLength}`;

		const [streakLeaderId, streak] = this.streaks.leader ?? [];

		// If there is a streak leader, it must be one of the guessers.
		const streakLeader = streak && guessers.find(({ id }) => id === streakLeaderId);
		if (streakLeader) {
			footerText += ` • ${streakLeader.tag} has a streak of ${streak} 🔥`;
		}

		if (this.goal) {
			footerText += ` • Playing to ${this.goal} points`;
		}

		const { title, author, uri } = currentlyPlaying!.info;
		const guessedThisRound = this.guessedAnswer();

		const embedTitle = guessed
			? `${doubleGuesser ? guessers[0] : guessers.join(' and ')} guessed it! 🎉`
			: `${guessedThisRound === AcceptedAnswer.Neither ? `Nobody got it` : `Only the ${guessedThisRound} was guessed`}! 🙁`;

		const embed = createEmbed(embedTitle, BrandingColors.Secondary)
			.setURL(uri)
			.setTitle(`That was "${title}" by ${author}`)
			.addField('Leaderboard', this.leaderboard.compute())
			.setFooter({ text: footerText });

		await this.textChannel.send({ embeds: [embed] });
	}

	public guessAnswer(guess: string, user: User) {
		switch (this.acceptedAnswer) {
			case AcceptedAnswer.Song: {
				return this.guessSong(guess, user);
			}

			case AcceptedAnswer.Artist: {
				return this.guessArtist(guess, user);
			}

			case AcceptedAnswer.Either: {
				return this.guessArtist(guess, user) || this.guessSong(guess, user);
			}

			case AcceptedAnswer.Both: {
				// if the song is guessed, guess the artists
				if (this.roundData.playersGuessedTrackName.size) {
					return this.guessArtist(guess, user);
				}

				// if the main artist is guessed, guess the song
				if (this.roundData.trackArtistsGuessed[this.roundData.primaryArtist].size) {
					return this.guessArtist(guess, user);
				}

				// if neither is already guessed, guess both
				return this.guessArtist(guess, user) || this.guessArtist(guess, user);
			}
			// To shut up the linter, maybe this Neither enum is not the way to go
			case AcceptedAnswer.Neither: {
				return false;
			}
		}
	}
}
