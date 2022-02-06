import type { CommandInteraction, Guild, Snowflake, GuildTextBasedChannel, User, VoiceChannel, MessageOptions } from 'discord.js';
import type { Playlist } from '#utils/audio';
import { bold, inlineCode, italic, userMention } from '@discordjs/builders';
import { DurationFormatter, Time } from '@sapphire/time-utilities';
import { StreakCounter } from '#game/StreakCounter';
import { jaroWinkler } from '@skyra/jaro-winkler';
import { Leaderboard } from '#game/Leaderboard';
import { createEmbed } from '#utils/responses';
import { UseForkedEm } from '#utils/decorators';
import { container } from '@sapphire/framework';
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
	textChannel: GuildTextBasedChannel;
	voiceChannel: VoiceChannel;
	hostUser: User;
	playlist: Playlist;
	acceptedAnswer?: AcceptedAnswer;
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
const kGuessThreshold = 0.75 as const;
const durationFormatter = new DurationFormatter();

export class Game {
	public readonly queue: Queue;
	public readonly leaderboard: Leaderboard;
	public readonly streaks: StreakCounter;
	public readonly voiceChannel: VoiceChannel;
	public readonly textChannel: GuildTextBasedChannel;
	public readonly hostUser: User;
	public readonly guild: Guild;
	public readonly acceptedAnswer: AcceptedAnswer;

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
	 * The person(s) who guessed correctly this round, if any. Will be multiple
	 * for `AcceptedAnswer.Both`.
	 */
	public guessersThisRound: User[] = [];

	private readonly startTime = Date.now();

	public constructor(data: GameData) {
		this.textChannel = data.textChannel;
		this.voiceChannel = data.voiceChannel;
		this.hostUser = data.hostUser;
		this.acceptedAnswer = data.acceptedAnswer ?? AcceptedAnswer.Either;
		this.goal = data.goal;
		this.guild = this.textChannel.guild;
		this.queue = new Queue(this, data.playlist);
		this.leaderboard = new Leaderboard();
		this.streaks = new StreakCounter();

		const players = this.voiceChannel.members
			.filter(({ user }) => !user.bot)
			.map<[Snowflake, Player]>((member) => [
				member.id,
				{ id: member.id, lastGameEntryTime: Date.now(), totalPlayTime: 0, songsListenedTo: 0 }
			]);

		this.players = new Map(players);
	}

	public async start(interaction: CommandInteraction) {
		const answerType = [AcceptedAnswer.Song, AcceptedAnswer.Artist].includes(this.acceptedAnswer)
			? this.acceptedAnswer.toLowerCase()
			: `song ${italic(this.acceptedAnswer === AcceptedAnswer.Both ? 'and' : 'or')} artist`;

		const description = `The game has begun! You have ${inlineCode('30')} seconds to ${bold(inlineCode('/guess'))} the name of the ${answerType}`;
		const embed = createEmbed(description)
			.setAuthor({ name: `Hosted by ${this.hostUser.tag}`, iconURL: this.hostUser.displayAvatarURL({ size: 128, dynamic: true }) })
			.setTitle(`🎶 Playing the playlist "${this.queue.playlist.name}"`);

		if (this.goal) {
			embed.setFooter({ text: `Playing to ${this.goal} points` });
		}

		await interaction.editReply({ embeds: [embed] });
		return this.queue.next();
	}

	public guess(user: User, guess: string) {
		const isValid = this.validateAnswer(guess);
		if (!isValid) {
			return false;
		}

		this.guessersThisRound.push(user);
		return true;
	}

	@UseForkedEm
	public async end(reason: GameEndReason, sendFn: (options: MessageOptions) => Promise<unknown> = this.textChannel.send.bind(this.textChannel)) {
		container.games.delete(this.guild.id);
		await this.queue.end();

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
				[GameEndReason.HostLeft]: `The game ended because the host left the voice channel 😓`,
				[GameEndReason.PlaylistEnded]: `We ran through every song in the playlist! 🎶`,
				[GameEndReason.Other]: `Good game! 🥳`
			};

			const embed = createEmbed(descriptions[reason])
				.setThumbnail(leader?.displayAvatarURL({ dynamic: true, size: 256 }) ?? '')
				.setTitle(this.leaderboard.leader ? `🎉 ${leader?.tag ?? 'An unknown user'} won 🎉` : '😔 Nobody won')
				.addField('Time Elapsed', durationFormatter.format(Date.now() - this.startTime).toString(), true)
				.addField('Tracks Played', inlineCode(this.queue.tracksPlayed.toString()), true)
				.addField('Leaderboard (Top 10)', this.leaderboard.compute())
				.setFooter({ text: 'Nice job! Play again sometime :)' });

			await sendFn({ embeds: [embed] });
		}

		// If one or less song was played, it's not worth making database calls.
		if (this.queue.tracksPlayed > 1) {
			const existingMembers = await container.db.members.find(
				{ userId: { $in: [...this.players.keys()] }, guildId: this.guild.id },
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

				const points = Math.round((songsGuessedCorrectly / player.songsListenedTo) * (timePlayed / Time.Minute) * multiplier);

				const existingMember = existingMembers.find(({ userId }) => userId === player.id);
				const member = existingMember ?? container.db.members.create({ userId: player.id, guildId: this.guild.id });

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

				const rankedUp = originalRank !== member.rank;
				if (reason !== GameEndReason.TextChannelDeleted && (songsGuessedCorrectly || rankedUp)) {
					let content = `${userMention(player.id)}, thanks for playing! You listened to ${
						player.songsListenedTo
					} songs, guessed ${songsGuessedCorrectly} of them correctly, `;

					content +=
						originalLevel === member.level
							? `and earned ${points} points.`
							: `earned ${points} points, and have reached level ${member.level}! 🥳`;

					if (rankedUp) {
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
		const author = this.queue.currentlyPlaying!.info.author.toLowerCase();
		return guess === author || jaroWinkler(guess, author) >= kGuessThreshold;
	}

	private validateSong(guess: string) {
		const song = this.queue.currentlyPlaying!.info.title.toLowerCase();

		// "Blank Space - Taylor Swift" -> "Blank Space"
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
