import { DMChannel, Message, MessagePayload, MessageOptions, Snowflake, TextChannel, PartialDMChannel, Collection, GuildMember } from 'discord.js';
import { AcceptedAnswer, EmbedColor, GameType } from '#types/Enums';
import { Game, Player } from '#game/Game';
import { cleanName, resolveThumbnail } from '#utils/audio';
import { createEmbed } from '#utils/responses';
import { container } from '@sapphire/framework';
import { getDuplicates } from '#utils/common';
import { isDMChannel } from '@sapphire/discord.js-utilities';

export class BinbGame extends Game {
	public readonly gameType = GameType.Binb;

	public async guess(message: Message) {
		const guess = cleanName(message.content);
		const guesserID = message.author.id;
		let guessed: AcceptedAnswer | null = null;

		if (!this.round.songGuessers.includes(guesserID)) {
			guessed = this.processSongGuess(guess, guesserID) ? AcceptedAnswer.Song : null;
		}

		let artistGuessed = null;
		if (!guessed) {
			artistGuessed = this.processArtistGuess(guess, guesserID);
			guessed = artistGuessed ? AcceptedAnswer.Artist : null;
		}

		const promises: Promise<unknown>[] = [];

		if (guessed) {
			const article = guessed === AcceptedAnswer.Artist && artistGuessed !== this.round.primaryArtist ? 'a featuring' : 'the';
			const embed = createEmbed(`✅ You guessed ${article} ${guessed}`);
			promises.push(message.reply({ embeds: [embed] }));
		}

		if (guessed && this.guessedBoth(guesserID)) {
			// User has guessed both the primary artist and song
			const embed = createEmbed(`✅ ${message.author.tag} got it in ${((Date.now() - this.round.startTime) / 1000).toPrecision(2)}s!`);
			promises.push.apply(this.dmAllPlayers({ embeds: [embed] }));
			if (this.everyoneGuessedBoth()) {
				promises.push(this.queue.player.stop());
			}
		}

		await Promise.all(promises);
	}

	public async onTrackEnd() {
		const everybodyPassed = this.round.passedPlayers.size === this.players.size;
		const { tracksPlayed, playlistLength, nowPlaying } = this.queue;
		let embedFooter = `${tracksPlayed}/${playlistLength}`;
		let embedDescription = everybodyPassed ? 'Everybody passed 🏃' : '';
		// const prevLeaderboard = new Collection(this.leaderboard);

		if (!everybodyPassed) {
			const { songGuessers, primaryArtistGuessers, artistGuessers, primaryArtist } = this.round;
			const primaryArtistAndSongGuessers = [...songGuessers, ...primaryArtistGuessers];

			// Give 0.5 points for each of primary artist and song
			for (const guesser of primaryArtistAndSongGuessers) {
				this.leaderboard.inc(guesser, 0.5);
			}

			// Give 0.25 points for each 'other' artist
			for (const [artist, guessers] of artistGuessers.entries()) {
				// Skip primary artist because it's already scored
				if (artist === primaryArtist) {
					continue;
				}

				for (const guesser of guessers) {
					this.leaderboard.inc(guesser, 0.25);
				}
			}

			// Give bonus points to 1st, 2nd, 3rd double guessers
			const doubleGuessers = getDuplicates(primaryArtistAndSongGuessers);
			for (const [index, doubleGuesser] of doubleGuessers.entries()) {
				this.leaderboard.inc(doubleGuesser, 1.5 - index * 0.5);
				if (index === 2) {
					break;
				}
			}

			if (primaryArtistAndSongGuessers.length) {
				// There are players who guessed something
				if (primaryArtistAndSongGuessers.length === 2 * this.players.size) {
					embedDescription = 'Well done everyone! You all guessed it!';
				} else {
					// Not everyone got the answer, check if anyone got it
					embedDescription = doubleGuessers.length
						? 'Well done to those who got it!'
						: 'No one got both song and artist! 🙁 Well done if you got one of them!';
				}
			} else {
				embedDescription = 'Nobody guessed any of it! 🙁 That was a hard one!';
			}

			const [streakLeaderId, streak] = this.streaks.leader ?? [];

			// If there is a streak leader, it must be one of the guessers.
			const streakLeader = streak && doubleGuessers.find((id) => id === streakLeaderId);
			if (streakLeader) {
				embedFooter += ` • <@${streakLeader}> has a streak of ${streak} 🔥`;
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

		const embed = createEmbed(embedDescription, EmbedColor.Secondary)
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

		await Promise.all(this.dmAllPlayers({ embeds: [embed] }));
	}

	public validGuessChannel(channel: TextChannel | DMChannel | PartialDMChannel) {
		return isDMChannel(channel);
	}

	protected calcPointsDivisor(songsListenedTo: number) {
		/*
		In Binb mode the playersScore includes 1st 2nd & 3rd bonuses.
		The following makes the significance of this bonus less with less players
		so that a single player can't farm points in this mode playing by themselves, abusing the 1st place bonus.
		With 1 player the points are equivalent to StandardGame (bonus is offset)
		As the number of players size increases, so does the significance of the bonuses.
		*/
		return songsListenedTo * (1 + 1.5 / this.players.size);
	}

	protected getPlayers(vcMembers: Collection<string, GuildMember>) {
		// TODO: Prompt players to join the game with a button.
		const basePlayer: Omit<Player, 'id'> = { lastGameEntryTime: Date.now(), totalPlayTime: 0, songsListenedTo: 0 };
		return new Collection(vcMembers.map<[Snowflake, Player]>((member) => [member.id, { ...basePlayer, id: member.id }]));
	}

	private guessedBoth(user: Snowflake) {
		return this.round.primaryArtistGuessers.includes(user) && this.round.songGuessers.includes(user);
	}

	private everyoneGuessedBoth() {
		return this.round.primaryArtistGuessers.length === this.players.size && this.round.songGuessers.length === this.players.size;
	}

	private dmAllPlayers(options: string | MessagePayload | MessageOptions) {
		const promises: Promise<unknown>[] = [];
		for (const playerID of this.players.keys()) {
			promises.push(container.client.users.send(playerID, options));
		}
		return promises;
	}
}
