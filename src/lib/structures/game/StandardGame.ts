import type { Message, Snowflake, User } from 'discord.js';
import { Game, AcceptedAnswer, GameData, GameType } from '#game/Game';
import { BrandingColors } from '#utils/constants';
import { createEmbed } from '#utils/responses';
import { container } from '@sapphire/framework';

export class StandardGame extends Game {
	public gameType: GameType.Standard = GameType.Standard;

	public constructor(data: GameData) {
		super(data);
	}

	public async guess(message: Message) {
		const guess = message.content.toLowerCase();
		const guessedBefore = this.guessedThisRound();
		const guessedNow = this.processGuess(guess, message.author.id);
		const promises: Promise<unknown>[] = [];

		if (!guessedNow) {
			return;
		}

		const isHalfGuessedNow = this.acceptedAnswer === AcceptedAnswer.Both && !guessedBefore && guessedNow;

		const halfGuessedString = isHalfGuessedNow
			? ` **"${message.content}"** is the ${guessedNow.toLowerCase()}'s name. You're halfway there!`
			: '';

		const embed = createEmbed(`✅ You got it!${halfGuessedString}`);

		promises.push(message.channel.send({ embeds: [embed] }));

		if (!isHalfGuessedNow) {
			promises.push(this.queue.player.stop());
		}

		await Promise.all(promises);
	}

	public async onTrackEnd() {
		const playersGuessedSong = this.round.guessedSong;
		const playersGuessedArtist = this.round.guessedArtists.get(this.round.primaryArtist)!;
		// Ensure players are only in here once
		const uniqueGuessers = [...new Set([...playersGuessedSong, ...playersGuessedArtist])];
		const guessers = (await Promise.all(
			uniqueGuessers.map((id) => container.client.users.fetch(id).catch(() => null)).filter(Boolean)
		)) as User[];
		const numGuessers = guessers.length;
		const requiredBoth = this.acceptedAnswer === AcceptedAnswer.Both;
		const doubleGuesser = requiredBoth && numGuessers === 1 && playersGuessedSong.length && playersGuessedArtist.length;

		// 3 cases that the song was 'guessed': someone got it (one or either of artist or song) || 1 person got both || two different people got 1 each
		const guessed = (!requiredBoth && numGuessers) || doubleGuesser || numGuessers === 2;

		if (guessed) {
			if (numGuessers === 1) {
				this.leaderboard.inc(guessers[0]!.id);
			} else {
				// There should only ever be 2 guessers but made generic anyway
				for (const guesser of guessers) {
					this.leaderboard.inc(guesser!.id, 1 / numGuessers);
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
		const guessedThisRound = this.guessedThisRound();

		const embedTitle = guessed
			? `${doubleGuesser ? guessers[0] : guessers.join(' and ')} guessed it! 🎉`
			: `${guessedThisRound ? `Only the ${guessedThisRound} was guessed` : `Nobody got it`}! 🙁`;

		const embed = createEmbed(embedTitle, BrandingColors.Secondary)
			.setURL(uri)
			.setTitle(`That was "${title}" by ${author}`)
			.addField('Leaderboard', this.leaderboard.compute())
			.setFooter({ text: footerText });

		await this.textChannel.send({ embeds: [embed] });
	}

	protected processGuess(guess: string, user: Snowflake): AcceptedAnswer.Song | AcceptedAnswer.Artist | null {
		switch (this.acceptedAnswer) {
			case AcceptedAnswer.Song: {
				return this.processSongGuess(guess, user) ? AcceptedAnswer.Song : null;
			}

			case AcceptedAnswer.Artist: {
				return this.processArtistGuess(guess, user) ? AcceptedAnswer.Artist : null;
			}

			case AcceptedAnswer.Either: {
				if (this.processArtistGuess(guess, user)) {
					return AcceptedAnswer.Artist;
				} else if (this.processSongGuess(guess, user)) {
					return AcceptedAnswer.Song;
				}
				return null;
			}

			case AcceptedAnswer.Both: {
				// If the song is guessed, guess the artists
				if (this.round.guessedSong.length) {
					return this.processArtistGuess(guess, user) ? AcceptedAnswer.Artist : null;
				}

				// If the main artist is guessed, guess the song
				if (this.round.guessedArtists.get(this.round.primaryArtist)!.length) {
					return this.processSongGuess(guess, user) ? AcceptedAnswer.Song : null;
				}

				// If neither is already guessed, guess both
				if (this.processArtistGuess(guess, user)) {
					return AcceptedAnswer.Artist;
				} else if (this.processSongGuess(guess, user)) {
					return AcceptedAnswer.Song;
				}
				return null;
			}
		}
	}

	private guessedThisRound(): AcceptedAnswer.Artist | AcceptedAnswer.Song | null {
		// Check if someone guessed song name or primary artist
		if (this.round.guessedSong.length) {
			return AcceptedAnswer.Song;
		}
		if (this.round.guessedArtists.get(this.round.primaryArtist)!.length) {
			return AcceptedAnswer.Artist;
		}

		return null;
	}
}
