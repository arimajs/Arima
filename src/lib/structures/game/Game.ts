import type { CommandInteraction, Guild, Snowflake, TextChannel, User, VoiceChannel } from 'discord.js';
import { bold, inlineCode, italic, time, userMention } from '@discordjs/builders';
import { DurationFormatter, Time } from '@sapphire/time-utilities';
import { StreakCounter } from '#game/StreakCounter';
import { jaroWinkler } from '@skyra/jaro-winkler';
import { Leaderboard } from '#game/Leaderboard';
import { createEmbed } from '#utils/responses';
import { container } from '@sapphire/framework';
import { shuffle } from '#utils/common';
import { Queue } from '#game/Queue';

// This setting will be configured per-game by the user, and defaults to
// `AcceptedAnswer.Either`.
export enum AcceptedAnswer {
	Song = 'song',
	Artist = 'artist',
	Either = 'either',
	Both = 'both'
}

// Descriptions for each reason are located where they are used to end the game.
export enum GameEndReason {
	HostLeft,
	PlaylistEnded,
	GoalMet,
	TextChannelDeleted,
	GuildInaccessible,
	Other
}

export interface GameData {
	textChannel: TextChannel;
	voiceChannel: VoiceChannel;
	hostUser: User;
	tracks: string[];
	acceptedAnswer?: AcceptedAnswer;
	playlistName: string;
	goal?: number;
}

// More info located in voiceStateUpdate listener.
export interface Player {
	lastGameEntryTime?: number;
	totalPlayTime: number;
	songsListenedTo: number;
	id: Snowflake;
}

// Might be changed in the future after more testing.
const kGuessThreshold = 0.9 as const;
const durationFormatter = new DurationFormatter();

export class Game {
	public readonly queue: Queue;
	public readonly leaderboard: Leaderboard;
	public readonly streaks: StreakCounter;
	public readonly voiceChannel: VoiceChannel;
	public readonly textChannel: TextChannel;
	public readonly hostUser: User;
	public readonly guild: Guild;

	/**
	 * The number of points to play to. Optionally provided by the user
	 * per-game.
	 */
	public readonly goal?: number;
	public players: Map<Snowflake, Player>;

	/**
	 * When playing with `AcceptedAnswer.Both`, this property is used to store
	 * which has been guessed this round, if any.
	 */
	public guessedThisRound?: AcceptedAnswer.Song | AcceptedAnswer.Artist;

	/**
	 * The person who guessed correctly this round, if any. Will probably be
	 * refactored to fit multiple users in the future for `AcceptedAnswer.Both`.
	 */
	public guesserThisRound?: User;

	private readonly startTime = Date.now();
	private readonly acceptedAnswer: AcceptedAnswer;
	private readonly playlistName: string;

	public constructor(data: GameData) {
		this.textChannel = data.textChannel;
		this.voiceChannel = data.voiceChannel;
		this.hostUser = data.hostUser;
		this.acceptedAnswer = data.acceptedAnswer ?? AcceptedAnswer.Either;
		this.goal = data.goal;
		this.guild = this.textChannel.guild;
		this.playlistName = data.playlistName;
		this.queue = new Queue(this, shuffle(data.tracks));
		this.leaderboard = new Leaderboard();
		this.streaks = new StreakCounter();

		const players = this.voiceChannel.members.map<[Snowflake, Player]>((member) => [
			member.id,
			{ id: member.id, lastGameEntryTime: Date.now(), totalPlayTime: 0, songsListenedTo: 0 }
		]);

		this.players = new Map(players);
	}

	public async start(interaction: CommandInteraction) {
		const answerType = [AcceptedAnswer.Song, AcceptedAnswer.Artist].includes(this.acceptedAnswer)
			? this.acceptedAnswer
			: `song ${italic(this.acceptedAnswer === AcceptedAnswer.Both ? 'and' : 'or')} artist`;

		const embed = createEmbed(`The game has begun! You have ${inlineCode('30')} seconds to guess the name of the ${answerType} name`)
			.setAuthor(`Hosted by ${this.hostUser.tag}`, this.hostUser.displayAvatarURL({ size: 128, dynamic: true }))
			.setTitle(`🎶 Playing the playlist "${this.playlistName}"`)
			.setFooter(this.goal ? `Playing to ${this.goal} points` : '');

		await interaction.reply({ embeds: [embed] });
		return this.queue.next();
	}

	// In the eventual guess command, the bot will store a variable representing
	// whether the answer was "half" guessed (if `guessedThisRound` is
	// populated). Then, after calling this function, respond publicly:
	//  - 'You got it! **"__guess__"** is the song's __type__. You're halfway there! ✅'
	//     if `true` is returned and there was previously no `guessedThisRound`
	//     but now there is.
	//  - 'Correct! ✅' and skip the song if `true` is returned.
	//  - 'Sorry, **"__guess__"** is incorrect! ❌' if `false` is returned.
	public guess(user: User, guess: string) {
		const isValid = this.validateAnswer(guess);
		if (!isValid) {
			return false;
		}

		this.guesserThisRound = user;
		return true;
	}

	public async end(reason: GameEndReason) {
		await this.queue.end();
		container.games.delete(this.guild.id);

		if (reason === GameEndReason.GuildInaccessible) {
			return;
		}

		let leader: User | null = null;
		const leaderId = this.leaderboard.leader?.[0];
		if (leaderId) {
			leader = await container.client.users.fetch(leaderId).catch(() => null);
		}

		if (reason !== GameEndReason.TextChannelDeleted) {
			const descriptions = {
				[GameEndReason.GoalMet]: `The goal of **${this.goal}** 🥅 was hit!`,
				[GameEndReason.HostLeft]: `The host left the voice channel 😓`,
				[GameEndReason.PlaylistEnded]: `We ran through every song in the playlist! 🎶`,
				[GameEndReason.Other]: `Good game! 🥳`
			};

			const timeElapsed = `${durationFormatter.format(Date.now() - this.startTime)} (started ${time(this.startTime * Time.Second)})`;

			const embed = createEmbed(descriptions[reason])
				.setThumbnail(leader?.displayAvatarURL({ dynamic: true, size: 256 }) ?? '')
				.setTitle(this.leaderboard.leader ? `🎉 ${leader?.tag ?? 'An unknown user'} won 🎉` : '😔 Nobody won')
				.addField('Time Elapsed', timeElapsed, true)
				.addField('Tracks Played', inlineCode(this.queue.tracksPlayed.toString()), true)
				.addField('Leaderboard (Top 10)', this.leaderboard.compute())
				.setFooter('Nice job! Play again sometime :)');

			await this.textChannel.send({ embeds: [embed] });
		}

		// If one or less song was played, it's not worth making database calls.
		if (this.queue.tracksPlayed > 1) {
			const existingMembers = await container.db.members.find(
				{ _id: { $in: [...this.players.keys()] }, guildId: this.guild.id },
				{ fields: ['gamesPlayed', 'gamesWon', 'points'] }
			);

			for (const player of this.players.values()) {
				const songsGuessedCorrectly = this.leaderboard.get(player.id) ?? 0;

				let timePlayed = player.totalPlayTime;

				// If the player is still in the voice channel, add to their time played.
				if (player.lastGameEntryTime) {
					timePlayed += Date.now() - player.lastGameEntryTime;
				}

				const isWinner = player.id === leader?.id;
				const multiplier = isWinner ? 1500 : 1000;
				const points = Math.round((songsGuessedCorrectly / player.songsListenedTo) * (timePlayed * Time.Minute) * multiplier);

				const existingMember = existingMembers.find(({ _id }) => _id === player.id);
				const member = existingMember ?? container.db.members.create({ _id: player.id, guildId: this.guild.id });

				const originalLevel = member.level;
				member.points += points;

				const originalRank = member.rank;
				member.gamesPlayed++;

				if (isWinner) {
					member.gamesWon++;
				}

				if (!existingMember) {
					container.db.em.persist(member);
				}

				if (reason !== GameEndReason.TextChannelDeleted) {
					let content = `${userMention(player.id)}, thanks for playing! You listened to ${
						player.songsListenedTo
					} songs, guessed ${songsGuessedCorrectly} of them correctly, `;

					if (originalLevel === member.level) {
						content += `and earned ${points} points.`;
					} else {
						content += `earned ${points} points, and are now level ${member.level}! 🥳`;
					}

					if (originalRank !== member.rank) {
						content += ` You also ranked up from ${originalRank} musician to ${bold(
							`${member.rank} musician`
						)} thanks to your epic song-guessing skills!`;
					}

					await this.textChannel.send(content);
				}
			}

			await container.db.em.flush();
		}
	}

	public validateAnswer(guess: string) {
		switch (this.acceptedAnswer) {
			case AcceptedAnswer.Song: {
				return this.validateSong(guess);
			}

			case AcceptedAnswer.Artist: {
				return this.validateArtist(guess);
			}

			case AcceptedAnswer.Either: {
				return this.validateArtist(guess) || this.validateSong(guess);
			}

			case AcceptedAnswer.Both: {
				if (this.guessedThisRound) {
					return this.guessedThisRound === AcceptedAnswer.Song ? this.validateArtist(guess) : this.validateSong(guess);
				}

				const guessedArtist = this.validateArtist(guess);
				if (guessedArtist) {
					this.guessedThisRound = AcceptedAnswer.Artist;
					return true;
				}

				const guessedSong = this.validateSong(guess);
				if (guessedSong) {
					this.guessedThisRound = AcceptedAnswer.Song;
					return true;
				}

				return false;
			}
		}
	}

	private validateArtist(guess: string) {
		const author = this.queue.currentlyPlaying!.author.toLowerCase();
		return guess === author || jaroWinkler(guess, author) >= kGuessThreshold;
	}

	private validateSong(guess: string) {
		const song = this.queue.currentlyPlaying!.title.toLowerCase();

		// "Blank Space  -  Taylor Swift" -> "Blank Space"
		// "Blank Space (Lyric Video)" -> "Blank Space"
		const songWithoutSuffix = song.replace(/\s*\(.*|\s*- .*/, '');

		// "Taylor Swift  -  Blank Space" -> "Blank Space"
		const songWithoutPrefix = song.replace(/.* -\s*/, '');

		// Applies both of the above, one at a time.
		// "Taylor Swift - Blank Space (Lyrics Video)" -> "Blank Space"
		let songWithoutSuffixAndPrefix = song;
		songWithoutSuffixAndPrefix = songWithoutSuffixAndPrefix.replace(/.* -\s*/, '');
		songWithoutSuffixAndPrefix = songWithoutSuffixAndPrefix.replace(/\s*\(.*|\s*- .*/, '');

		// Try a bunch of different variations to try to match the most accurate track name.
		const validSongVariations = [...[songWithoutSuffixAndPrefix, songWithoutPrefix, songWithoutSuffix].filter((str) => str !== song), song];

		// The guess is valid if it's an exact match or very close to any variation.
		return validSongVariations.includes(guess) || validSongVariations.some((str) => jaroWinkler(guess, str) >= kGuessThreshold);
	}
}
